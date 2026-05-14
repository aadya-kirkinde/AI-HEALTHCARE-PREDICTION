"""OutbreakOS — FastAPI backend server.

Endpoints:
  GET    /api/health
  GET    /api/feed
  GET    /api/outbreaks
  GET    /api/timeline
  GET    /api/sources
  POST   /api/intel/query
  POST   /api/ingest/trigger
  GET    /api/ingest/status
  GET    /api/settings
  PUT    /api/settings
  GET    /api/watchlist
  POST   /api/watchlist
  DELETE /api/watchlist/{item_id}

Run: uvicorn server:app --reload --port 8000
"""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from database import DB_PATH, get_conn, init_db
from ingestion import ingest_once, get_ingestion_status, start_background_worker
import rag

# ─── App setup ───────────────────────────────────────────────────────────────

app = FastAPI(
    title="OutbreakOS API",
    version="2.14.3",
    description="Global outbreak intelligence REST API",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    print("[server] initializing database…")
    init_db()
    print("[server] starting ingestion worker…")
    start_background_worker(interval_seconds=300)
    print("[server] initializing RAG pipeline…")
    rag.init_rag()
    print("[server] ready")


# ─── Models ──────────────────────────────────────────────────────────────────

class IntelQuery(BaseModel):
    question: str


class WatchlistAdd(BaseModel):
    item_id: str
    disease: Optional[str] = None
    region: Optional[str] = None
    source: Optional[str] = None
    severity: Optional[int] = None
    summary: Optional[str] = None


class SettingsPayload(BaseModel):
    mapProvider: Optional[str] = None
    mapStyle: Optional[str] = None
    refreshInterval: Optional[int] = None
    sourcePriority: Optional[list[str]] = None
    notifications: Optional[dict] = None


# ─── /api/health ─────────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    conn = get_conn()
    try:
        feed_count = conn.execute("SELECT COUNT(*) FROM feed_items").fetchone()[0]
        outbreak_count = conn.execute("SELECT COUNT(*) FROM outbreaks").fetchone()[0]
        last_log = conn.execute(
            "SELECT ran_at, status FROM ingestion_log ORDER BY ran_at DESC LIMIT 1"
        ).fetchone()
    finally:
        conn.close()

    return {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": "2.14.3",
        "services": {
            "database": "operational",
            "ingestion": "active",
            "vectorstore": "active" if rag.CHROMA_UP else "unavailable",
            "ollama": "active" if rag.OLLAMA_UP else "unavailable",
            "map_provider": "CARTO/OSM",
        },
        "stats": {
            "feed_items": feed_count,
            "outbreaks": outbreak_count,
            "last_ingest": dict(last_log) if last_log else None,
        }
    }


# ─── /api/feed ───────────────────────────────────────────────────────────────

@app.get("/api/feed")
async def get_feed(
    limit: int = Query(default=25, le=100),
    disease: Optional[str] = None,
    source: Optional[str] = None,
    min_severity: int = Query(default=1, ge=1, le=4),
    offset: int = 0,
):
    conn = get_conn()
    try:
        conditions = ["severity >= ?"]
        params: list = [min_severity]

        if disease:
            conditions.append("LOWER(disease) LIKE ?")
            params.append(f"%{disease.lower()}%")
        if source:
            conditions.append("LOWER(source) LIKE ?")
            params.append(f"%{source.lower()}%")

        where = " AND ".join(conditions)
        rows = conn.execute(
            f"""SELECT id, source, disease, region, country_code, lat, lng,
                       severity, title, summary, url, reliability,
                       published_at, ingested_at
                FROM feed_items
                WHERE {where}
                ORDER BY ingested_at DESC
                LIMIT ? OFFSET ?""",
            params + [limit, offset]
        ).fetchall()
        total = conn.execute(f"SELECT COUNT(*) FROM feed_items WHERE {where}", params).fetchone()[0]
    finally:
        conn.close()

    return {
        "items": [dict(r) for r in rows],
        "total": total,
        "limit": limit,
        "offset": offset,
        "last_updated": datetime.now(timezone.utc).isoformat(),
    }


# ─── /api/outbreaks ──────────────────────────────────────────────────────────

@app.get("/api/outbreaks")
async def get_outbreaks(
    min_severity: int = Query(default=1, ge=1, le=4),
    disease: Optional[str] = None,
):
    conn = get_conn()
    try:
        conditions = ["severity >= ?"]
        params: list = [min_severity]

        if disease:
            conditions.append("LOWER(disease) LIKE ?")
            params.append(f"%{disease.lower()}%")

        where = " AND ".join(conditions)
        rows = conn.execute(
            f"""SELECT id, disease, region, country, country_code, lat, lng,
                       cases, deaths, delta_7d, severity, status, source,
                       source_url, summary, reliability, first_seen, updated_at
                FROM outbreaks
                WHERE {where}
                ORDER BY severity DESC, updated_at DESC""",
            params
        ).fetchall()
    finally:
        conn.close()

    return {
        "outbreaks": [dict(r) for r in rows],
        "count": len(rows),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ─── /api/timeline ───────────────────────────────────────────────────────────

@app.get("/api/timeline")
async def get_timeline(outbreak_id: Optional[str] = None):
    conn = get_conn()
    try:
        if outbreak_id:
            rows = conn.execute(
                "SELECT * FROM timeline_events WHERE outbreak_id = ? ORDER BY at_pct ASC",
                (outbreak_id,)
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM timeline_events ORDER BY at_pct ASC"
            ).fetchall()
    finally:
        conn.close()

    return {
        "events": [dict(r) for r in rows],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ─── /api/sources ────────────────────────────────────────────────────────────

@app.get("/api/sources")
async def get_sources():
    conn = get_conn()
    try:
        rows = conn.execute(
            """SELECT source, reliability, COUNT(*) as item_count,
                      MAX(ingested_at) as last_item,
                      COUNT(DISTINCT disease) as diseases
               FROM feed_items
               GROUP BY source
               ORDER BY item_count DESC"""
        ).fetchall()
        log_rows = conn.execute(
            """SELECT source, status, ran_at, items_fetched, items_new
               FROM ingestion_log
               ORDER BY ran_at DESC
               LIMIT 50"""
        ).fetchall()
    finally:
        conn.close()

    sources = [dict(r) for r in rows]
    # Merge ingestion log
    log_by_src: dict = {}
    for lr in log_rows:
        d = dict(lr)
        if d["source"] not in log_by_src:
            log_by_src[d["source"]] = d

    for s in sources:
        s["last_run"] = log_by_src.get(s["source"])

    return {
        "sources": sources,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ─── /api/intel/query ────────────────────────────────────────────────────────

@app.post("/api/intel/query")
async def intel_query(body: IntelQuery):
    if not body.question.strip():
        raise HTTPException(status_code=400, detail="question is required")

    result = rag.query(body.question.strip())
    return result


# ─── /api/ingest ─────────────────────────────────────────────────────────────

@app.post("/api/ingest/trigger")
async def trigger_ingest():
    """Manually trigger an ingestion run."""
    new_count = ingest_once()
    rag.index_new_items()
    return {
        "status": "ok",
        "new_items": new_count,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/api/ingest/status")
async def ingest_status():
    return get_ingestion_status()


# ─── /api/settings ───────────────────────────────────────────────────────────

_settings_store: dict = {}


@app.get("/api/settings")
async def get_settings():
    defaults = {
        "mapProvider": "carto",
        "mapStyle": "dark",
        "refreshInterval": 30,
        "sourcePriority": ["WHO", "CDC", "ECDC", "PAHO", "ProMED"],
        "notifications": {"alerts": True, "digest": False, "pheic": True},
    }
    return {**defaults, **_settings_store}


@app.put("/api/settings")
async def update_settings(body: SettingsPayload):
    data = body.model_dump(exclude_none=True)
    _settings_store.update(data)
    return {**_settings_store, "saved": True}


# ─── /api/watchlist ──────────────────────────────────────────────────────────
# Server-side watchlist is per-process/in-memory; the frontend also persists
# to localStorage as the primary store. These endpoints enable cross-device sync.

_watchlist: dict[str, dict] = {}


@app.get("/api/watchlist")
async def get_watchlist():
    return {
        "items": list(_watchlist.values()),
        "count": len(_watchlist),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.post("/api/watchlist", status_code=201)
async def add_to_watchlist(body: WatchlistAdd):
    if not body.item_id.strip():
        raise HTTPException(status_code=400, detail="item_id is required")
    item = body.model_dump()
    item["added_at"] = datetime.now(timezone.utc).isoformat()
    _watchlist[body.item_id] = item
    return {"ok": True, "item": item}


@app.delete("/api/watchlist/{item_id}")
async def remove_from_watchlist(item_id: str):
    if item_id not in _watchlist:
        raise HTTPException(status_code=404, detail="item not in watchlist")
    _watchlist.pop(item_id)
    return {"ok": True, "removed": item_id}


# ─── entry point ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)


# ─── POST /api/analyze (alias for /api/intel/query) ───────────────────────────

@app.post("/api/analyze")
async def analyze(body: IntelQuery):
    """Alias for intel query — opens console with contextual RAG analysis."""
    if not body.question.strip():
        raise HTTPException(status_code=400, detail="question is required")
    result = rag.query(body.question.strip())
    return result


# ─── GET/POST /api/notifications ──────────────────────────────────────────────

_notification_store: list[dict] = []


@app.get("/api/notifications")
async def get_notifications(unread_only: bool = False):
    return {
        "notifications": _notification_store if not unread_only else [n for n in _notification_store if not n.get("read", False)],
        "count": len(_notification_store),
        "unread": sum(1 for n in _notification_store if not n.get("read", False)),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.post("/api/notifications/{notif_id}/read")
async def mark_read(notif_id: str):
    for n in _notification_store:
        if n.get("id") == notif_id:
            n["read"] = True
            return {"ok": True}
    raise HTTPException(status_code=404, detail="notification not found")


@app.post("/api/notifications/dismiss")
async def dismiss_notification(body: dict):
    notif_id = body.get("id")
    if notif_id:
        global _notification_store
        _notification_store = [n for n in _notification_store if n.get("id") != notif_id]
    return {"ok": True, "count": len(_notification_store)}
