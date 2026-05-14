"""OutbreakOS — Local RAG pipeline.

Embedding:  nomic-embed-text via Ollama
Vector DB:  ChromaDB (cosine similarity)
LLM:        llama3.2 via Ollama
Fallback:   SQLite keyword search when Ollama/ChromaDB unavailable

Confidence scoring:
  - vector similarity distance → [0,1] relevance score per chunk
  - final confidence = weighted mean of top-k scores (capped at 0.95)
  - < 0.4  → low   (keyword fallback or poor retrieval)
  - 0.4-0.7 → medium
  - > 0.7  → high
"""

import json
import sqlite3
import urllib.request
import urllib.error
from datetime import datetime
from pathlib import Path

from database import get_conn

OLLAMA_BASE = "http://localhost:11434"
EMBED_MODEL = "nomic-embed-text"
LLM_MODEL   = "llama3.2"

SYSTEM_PROMPT = """You are OutbreakOS, an AI biosurveillance analyst for the Global Health Intelligence Network.

STRICT RULES — follow every time:
1. Ground every claim in the provided SOURCE DOCUMENTS. Do not invent locations, case counts, or events not present in the sources.
2. Cite sources inline as [1], [2], etc. — always.
3. If the sources do not contain enough information to answer confidently, say exactly: "Insufficient source data — the ingestion pipeline may need more time to collect relevant reports."
4. Do not speculate about future trajectories unless a cited source explicitly projects them.
5. Keep answers concise: 2-4 sentences maximum unless the question requires a list.
6. Write for a public-health professional, not the general public. Be precise."""

# ─── Availability checks ──────────────────────────────────────────────────────

def _ollama_available() -> bool:
    try:
        req = urllib.request.Request(f"{OLLAMA_BASE}/api/tags", method="GET")
        with urllib.request.urlopen(req, timeout=3) as r:
            return r.status == 200
    except Exception:
        return False


def _chroma_available() -> bool:
    try:
        import chromadb
        return True
    except ImportError:
        return False


OLLAMA_UP  = False
CHROMA_UP  = False
_chroma_client = None
_collection    = None


def _init_chroma():
    global _chroma_client, _collection, CHROMA_UP
    if not _chroma_available():
        return
    try:
        import chromadb
        persist_path = str(Path(__file__).parent / "chroma_db")
        _chroma_client = chromadb.PersistentClient(path=persist_path)
        _collection = _chroma_client.get_or_create_collection(
            name="outbreak_intelligence",
            metadata={"hnsw:space": "cosine"}
        )
        CHROMA_UP = True
        print("[rag] ChromaDB initialized")
    except Exception as e:
        print(f"[rag] ChromaDB init failed: {e}")


def init_rag():
    global OLLAMA_UP
    OLLAMA_UP = _ollama_available()
    print(f"[rag] Ollama: {'available' if OLLAMA_UP else 'unavailable'}")
    _init_chroma()

    if OLLAMA_UP and CHROMA_UP:
        try:
            _index_feed_items()
        except Exception as e:
            print(f"[rag] initial indexing error: {e}")


# ─── Embedding ────────────────────────────────────────────────────────────────

def _embed(texts: list[str]) -> list[list[float]]:
    embeddings = []
    for text in texts:
        payload = json.dumps({"model": EMBED_MODEL, "prompt": text}).encode()
        req = urllib.request.Request(
            f"{OLLAMA_BASE}/api/embeddings",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=30) as r:
            data = json.loads(r.read())
            embeddings.append(data["embedding"])
    return embeddings


# ─── Indexing ─────────────────────────────────────────────────────────────────

def _index_feed_items():
    if not OLLAMA_UP or not CHROMA_UP or _collection is None:
        return
    conn = get_conn()
    items = conn.execute(
        """SELECT id, source, disease, region, summary, published_at
           FROM feed_items
           WHERE summary IS NOT NULL
           ORDER BY ingested_at DESC LIMIT 200"""
    ).fetchall()
    conn.close()

    if not items:
        return

    existing = set(_collection.get(ids=[r["id"] for r in items])["ids"])
    new_items = [r for r in items if r["id"] not in existing]

    if not new_items:
        return

    texts = [
        f"{r['disease'] or ''} {r['region'] or ''} — {r['summary'] or ''}"
        for r in new_items
    ]
    try:
        embeddings = _embed(texts)
        _collection.add(
            ids=[r["id"] for r in new_items],
            embeddings=embeddings,
            documents=texts,
            metadatas=[{
                "source":       r["source"],
                "disease":      r["disease"] or "",
                "region":       r["region"] or "",
                "published_at": r["published_at"] or "",
                "summary":      (r["summary"] or "")[:400],
            } for r in new_items]
        )
        print(f"[rag] indexed {len(new_items)} new items")
    except Exception as e:
        print(f"[rag] indexing error: {e}")


def index_new_items():
    try:
        _index_feed_items()
    except Exception as e:
        print(f"[rag] index_new_items error: {e}")


# ─── Retrieval ────────────────────────────────────────────────────────────────

def _retrieve_chroma(query: str, n: int = 6) -> tuple[list[dict], float]:
    """Returns (docs, confidence_score 0-1)."""
    if not OLLAMA_UP or not CHROMA_UP or _collection is None:
        return [], 0.0
    try:
        emb = _embed([query])[0]
        results = _collection.query(
            query_embeddings=[emb],
            n_results=min(n, _collection.count() or 1),
            include=["documents", "metadatas", "distances"]
        )
        docs = []
        distances = results.get("distances", [[]])[0]

        for i, doc in enumerate(results["documents"][0]):
            meta  = results["metadatas"][0][i]
            dist  = distances[i] if i < len(distances) else 1.0
            # cosine distance [0,2] → similarity [0,1]
            sim   = max(0.0, 1.0 - dist / 2.0)
            docs.append({
                "text":         doc,
                "source":       meta.get("source", ""),
                "disease":      meta.get("disease", ""),
                "region":       meta.get("region", ""),
                "published_at": meta.get("published_at", ""),
                "snippet":      meta.get("summary", doc[:200]),
                "score":        round(sim, 3),
            })

        # Weighted mean: top result weighted 3×, rest 1×
        if docs:
            weights = [3] + [1] * (len(docs) - 1)
            conf = sum(d["score"] * w for d, w in zip(docs, weights)) / sum(weights[:len(docs)])
            conf = min(0.95, conf)
        else:
            conf = 0.0

        return docs, round(conf, 3)
    except Exception as e:
        print(f"[rag] retrieval error: {e}")
        return [], 0.0


def _retrieve_sqlite(query: str, n: int = 6) -> tuple[list[dict], float]:
    """Keyword fallback. Returns (docs, low confidence)."""
    conn = get_conn()
    words = [w.strip() for w in query.lower().split() if len(w) > 3][:4]
    if not words:
        rows = conn.execute(
            "SELECT source, disease, region, summary, published_at FROM feed_items ORDER BY ingested_at DESC LIMIT ?",
            (n,)
        ).fetchall()
    else:
        like_clause = " OR ".join(f"LOWER(summary) LIKE ?" for _ in words)
        params = [f"%{w}%" for w in words] + [n]
        rows = conn.execute(
            f"SELECT source, disease, region, summary, published_at FROM feed_items WHERE {like_clause} ORDER BY severity DESC, ingested_at DESC LIMIT ?",
            params
        ).fetchall()
    conn.close()
    docs = []
    for r in rows:
        d = dict(r)
        d["snippet"] = (d.get("summary") or "")[:200]
        d["score"]   = 0.35
        docs.append(d)
    conf = 0.30 if docs else 0.0
    return docs, conf


# ─── LLM generation ──────────────────────────────────────────────────────────

def _build_context(docs: list[dict]) -> str:
    parts = []
    for i, d in enumerate(docs[:5], 1):
        src     = d.get("source", "Unknown")
        disease = d.get("disease", "")
        region  = d.get("region", "")
        snippet = d.get("snippet") or d.get("text", "")
        snippet = snippet[:350].strip()
        header  = f"SOURCE [{i}] — {src}"
        if disease: header += f" | {disease}"
        if region:  header += f" | {region}"
        date = (d.get("published_at") or "")[:10]
        if date: header += f" | {date}"
        parts.append(f"{header}\n{snippet}")
    return "\n\n".join(parts)


def _generate_ollama(system: str, user: str, model: str = LLM_MODEL) -> str:
    payload = json.dumps({
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user",   "content": user},
        ],
        "stream": False,
        "options": {"temperature": 0.05, "num_predict": 600}
    }).encode()
    req = urllib.request.Request(
        f"{OLLAMA_BASE}/api/chat",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=90) as r:
        data = json.loads(r.read())
        return data.get("message", {}).get("content", "")


def _keyword_answer(query: str, docs: list[dict]) -> str:
    if not docs:
        return "No relevant outbreak intelligence found for this query. The ingestion pipeline may be initializing — try again in a few minutes."
    lines = []
    for d in docs[:4]:
        src     = d.get("source", "Unknown")
        disease = d.get("disease", "")
        region  = d.get("region", "")
        snippet = (d.get("snippet") or d.get("summary") or d.get("text", ""))[:180]
        lines.append(f"[{src}] {disease} · {region}: {snippet}")
    return " | ".join(lines)


# ─── Reranking ────────────────────────────────────────────────────────────────

def _rerank(docs: list[dict], query: str) -> list[dict]:
    """Simple keyword-overlap boost on top of vector score."""
    query_words = set(query.lower().split())
    for d in docs:
        text_words = set((d.get("snippet") or d.get("text", "")).lower().split())
        overlap = len(query_words & text_words) / max(len(query_words), 1)
        d["score"] = min(0.95, d["score"] + overlap * 0.05)
    return sorted(docs, key=lambda x: x["score"], reverse=True)


# ─── Public query interface ───────────────────────────────────────────────────

def query(question: str) -> dict:
    """Execute a RAG query. Returns structured response with citations and confidence."""
    start = datetime.now()

    if CHROMA_UP and OLLAMA_UP:
        docs, conf = _retrieve_chroma(question, n=6)
        retrieval_mode = "vector"
    else:
        docs, conf = _retrieve_sqlite(question, n=6)
        retrieval_mode = "keyword"

    docs = _rerank(docs, question)

    citations = []
    for i, doc in enumerate(docs[:5], 1):
        citations.append({
            "n":       i,
            "src":     doc.get("source", "Unknown"),
            "title":   (f"{doc.get('disease','')} · {doc.get('region','')}").strip(" ·") or "Outbreak intelligence",
            "date":    (doc.get("published_at", "") or "")[:10],
            "url":     doc.get("url", ""),
            "snippet": (doc.get("snippet") or doc.get("text", ""))[:200],
            "score":   doc.get("score", 0.0),
        })

    answer_text = ""
    model_used  = "keyword-search"

    if OLLAMA_UP and docs:
        context = _build_context(docs[:5])
        user_msg = f"""SOURCE DOCUMENTS:
{context}

QUESTION: {question}

Instructions: Answer using only the sources above. Cite as [1], [2], etc. If sources are insufficient, state so explicitly."""
        try:
            answer_text = _generate_ollama(SYSTEM_PROMPT, user_msg)
            model_used  = LLM_MODEL
            # Boost confidence when Ollama generated a grounded answer
            if answer_text and "[" in answer_text:
                conf = min(0.95, conf + 0.08)
        except Exception as e:
            print(f"[rag] LLM generation failed: {e}")
            answer_text = _keyword_answer(question, docs)
            model_used  = "keyword-fallback"
            conf        = min(conf, 0.40)
    else:
        answer_text = _keyword_answer(question, docs)
        conf = min(conf, 0.35)

    elapsed = (datetime.now() - start).total_seconds()

    # Confidence label
    if conf >= 0.70:
        conf_label = "high"
    elif conf >= 0.40:
        conf_label = "medium"
    else:
        conf_label = "low"

    return {
        "question":  question,
        "answer":    answer_text,
        "citations": citations,
        "meta": {
            "sources":    len(citations),
            "model":      model_used,
            "latency":    f"{elapsed:.1f}s",
            "confidence": conf,
            "conf_label": conf_label,
            "retrieval":  retrieval_mode,
            "ollama":     OLLAMA_UP,
            "chroma":     CHROMA_UP,
        }
    }
