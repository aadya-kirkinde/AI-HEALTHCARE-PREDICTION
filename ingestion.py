"""OutbreakOS — RSS ingestion worker.

Ingests WHO, CDC, ECDC, ProMED, and Google News RSS feeds.
Normalizes items: disease extraction, severity scoring, geo tagging.
Deduplicates via content hash. Stores to SQLite.
"""

import hashlib
import html
import re
import sqlite3
import time
import threading
import urllib.request
import urllib.error
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

from database import DB_PATH, get_conn

# ─── Feed registry ────────────────────────────────────────────────────────────

FEEDS = [
    {
        "url": "https://www.who.int/rss-feeds/news-english.xml",
        "source": "WHO",
        "reliability": "OFFICIAL",
    },
    {
        "url": "https://www.ecdc.europa.eu/en/rss.xml",
        "source": "ECDC",
        "reliability": "OFFICIAL",
    },
    {
        "url": "https://promedmail.org/feed/?format=rss",
        "source": "ProMED",
        "reliability": "MEDIA",
    },
    # Google News disease-specific feeds
    {
        "url": "https://news.google.com/rss/search?q=H5N1+outbreak&hl=en-US&gl=US&ceid=US:en",
        "source": "Google News",
        "reliability": "MEDIA",
        "disease_hint": "H5N1",
    },
    {
        "url": "https://news.google.com/rss/search?q=mpox+outbreak&hl=en-US&gl=US&ceid=US:en",
        "source": "Google News",
        "reliability": "MEDIA",
        "disease_hint": "Mpox",
    },
    {
        "url": "https://news.google.com/rss/search?q=hantavirus&hl=en-US&gl=US&ceid=US:en",
        "source": "Google News",
        "reliability": "MEDIA",
        "disease_hint": "Hantavirus",
    },
    {
        "url": "https://news.google.com/rss/search?q=measles+outbreak&hl=en-US&gl=US&ceid=US:en",
        "source": "Google News",
        "reliability": "MEDIA",
        "disease_hint": "Measles",
    },
    {
        "url": "https://news.google.com/rss/search?q=cholera+outbreak&hl=en-US&gl=US&ceid=US:en",
        "source": "Google News",
        "reliability": "MEDIA",
        "disease_hint": "Cholera",
    },
    {
        "url": "https://news.google.com/rss/search?q=ebola+outbreak&hl=en-US&gl=US&ceid=US:en",
        "source": "Google News",
        "reliability": "MEDIA",
        "disease_hint": "Ebola",
    },
    {
        "url": "https://news.google.com/rss/search?q=dengue+fever+outbreak&hl=en-US&gl=US&ceid=US:en",
        "source": "Google News",
        "reliability": "MEDIA",
        "disease_hint": "Dengue",
    },
]

# ─── Disease keyword mapping ───────────────────────────────────────────────────

DISEASE_PATTERNS = {
    "H5N1":       [r"\bH5N1\b", r"avian influenza", r"bird flu"],
    "Mpox":       [r"\bmpox\b", r"monkeypox"],
    "Measles":    [r"\bmeasles\b", r"rubeola"],
    "Hantavirus": [r"\bhantavirus\b", r"\bhantaan\b"],
    "Cholera":    [r"\bcholera\b"],
    "Ebola":      [r"\bebola\b", r"\bEVD\b"],
    "Marburg":    [r"\bmarburg\b"],
    "MERS-CoV":   [r"\bMERS\b", r"mers-cov"],
    "Dengue":     [r"\bdengue\b"],
    "Rabies":     [r"\brabies\b"],
}

# ─── Country/region geo lookup (subset) ───────────────────────────────────────

COUNTRY_GEO = {
    "cambodia":       ("KHM", "Cambodia",       11.5564,   104.9282),
    "congo":          ("COD", "DR Congo",        -4.0383,    21.7587),
    "drc":            ("COD", "DR Congo",        -4.0383,    21.7587),
    "romania":        ("ROU", "Romania",         45.9432,    24.9668),
    "united states":  ("USA", "United States",   37.0902,  -95.7129),
    "usa":            ("USA", "United States",   37.0902,  -95.7129),
    "california":     ("USA", "California, USA", 36.7783,  -119.4179),
    "argentina":      ("ARG", "Argentina",      -38.4161,  -63.6167),
    "indonesia":      ("IDN", "Indonesia",       -0.7893,   113.9213),
    "saudi arabia":   ("SAU", "Saudi Arabia",    23.8859,    45.0792),
    "india":          ("IND", "India",           20.5937,    78.9629),
    "china":          ("CHN", "China",           35.8617,   104.1954),
    "brazil":         ("BRA", "Brazil",         -14.2350,  -51.9253),
    "nigeria":        ("NGA", "Nigeria",          9.0820,     8.6753),
    "sudan":          ("SDN", "Sudan",           12.8628,    30.2176),
    "uganda":         ("UGA", "Uganda",           1.3733,    32.2903),
    "kenya":          ("KEN", "Kenya",            0.0236,    37.9062),
    "philippines":    ("PHL", "Philippines",     12.8797,   121.7740),
    "thailand":       ("THA", "Thailand",        15.8700,   100.9925),
    "vietnam":        ("VNM", "Vietnam",         14.0583,   108.2772),
    "myanmar":        ("MMR", "Myanmar",         21.9162,    95.9560),
    "bangladesh":     ("BGD", "Bangladesh",      23.6850,    90.3563),
    "pakistan":       ("PAK", "Pakistan",        30.3753,    69.3451),
    "ukraine":        ("UKR", "Ukraine",         48.3794,    31.1656),
    "germany":        ("DEU", "Germany",         51.1657,    10.4515),
    "france":         ("FRA", "France",          46.2276,     2.2137),
    "united kingdom": ("GBR", "United Kingdom",  55.3781,    -3.4360),
    "uk":             ("GBR", "United Kingdom",  55.3781,    -3.4360),
    "mexico":         ("MEX", "Mexico",          23.6345,  -102.5528),
    "colombia":       ("COL", "Colombia",         4.5709,   -74.2973),
    "peru":           ("PER", "Peru",            -9.1900,   -75.0152),
    "ethiopia":       ("ETH", "Ethiopia",         9.1450,    40.4897),
    "ghana":          ("GHA", "Ghana",            7.9465,    -1.0232),
    "south africa":   ("ZAF", "South Africa",   -30.5595,    22.9375),
    "egypt":          ("EGY", "Egypt",           26.8206,    30.8025),
    "iran":           ("IRN", "Iran",            32.4279,    53.6880),
    "turkey":         ("TUR", "Turkey",          38.9637,    35.2433),
    "japan":          ("JPN", "Japan",           36.2048,   138.2529),
    "south korea":    ("KOR", "South Korea",     35.9078,   127.7669),
    "australia":      ("AUS", "Australia",      -25.2744,   133.7751),
    "canada":         ("CAN", "Canada",          56.1304,  -106.3468),
    "spain":          ("ESP", "Spain",           40.4637,    -3.7492),
    "italy":          ("ITA", "Italy",           41.8719,    12.5674),
}

# ─── Severity scoring ──────────────────────────────────────────────────────────

SEVERITY_KEYWORDS = {
    4: ["PHEIC", "pandemic", "emergency", "critical", "exponential", "out of control"],
    3: ["warning", "outbreak", "confirmed cases", "deaths", "fatalities", "spreading", "cluster"],
    2: ["advisory", "monitoring", "investigation", "suspected", "alert"],
    1: ["surveillance", "update", "situation report", "routine"],
}


def score_severity(text: str) -> int:
    text_lower = text.lower()
    for sev in (4, 3, 2, 1):
        if any(kw.lower() in text_lower for kw in SEVERITY_KEYWORDS[sev]):
            return sev
    return 1


def extract_disease(text: str, hint: str = None) -> str | None:
    if hint:
        return hint
    text_lower = text.lower()
    for disease, patterns in DISEASE_PATTERNS.items():
        for pattern in patterns:
            if re.search(pattern, text, re.IGNORECASE):
                return disease
    return None


def extract_region(text: str) -> tuple:
    text_lower = text.lower()
    for country_key, geo in COUNTRY_GEO.items():
        if country_key in text_lower:
            return geo
    return (None, None, None, None)


def clean_html(raw: str) -> str:
    if not raw:
        return ""
    # Strip HTML tags
    clean = re.sub(r"<[^>]+>", " ", raw)
    clean = html.unescape(clean)
    clean = re.sub(r"\s+", " ", clean).strip()
    return clean[:500]


def item_id(url: str, title: str) -> str:
    content = f"{url}|{title}"
    return hashlib.sha256(content.encode()).hexdigest()[:24]


# ─── Fetch + parse RSS ────────────────────────────────────────────────────────

def fetch_rss(url: str, timeout: int = 12) -> ET.Element | None:
    headers = {
        "User-Agent": "OutbreakOS/2.0 (disease surveillance; https://outbreakos.io)",
        "Accept": "application/rss+xml, application/xml, text/xml, */*",
    }
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = resp.read()
        return ET.fromstring(data)
    except Exception as e:
        print(f"[ingestion] fetch error {url[:60]}: {e}")
        return None


def parse_items(root: ET.Element, feed_cfg: dict) -> list[dict]:
    items = []
    ns = {"atom": "http://www.w3.org/2005/Atom"}

    # Handle both RSS 2.0 and Atom
    channel = root.find("channel")
    entries = []
    if channel is not None:
        entries = channel.findall("item")
    else:
        entries = root.findall("atom:entry", ns) or root.findall("entry")

    source = feed_cfg["source"]
    reliability = feed_cfg["reliability"]
    disease_hint = feed_cfg.get("disease_hint")

    for entry in entries[:15]:
        # Title
        t = entry.find("title")
        title = clean_html(t.text if t is not None else "")
        if not title:
            continue

        # Link
        lk = entry.find("link")
        if lk is None:
            lk = entry.find("atom:link", ns)
        link = ""
        if lk is not None:
            link = lk.get("href") or lk.text or ""

        # Summary/description
        desc = entry.find("description") or entry.find("summary") or entry.find("atom:summary", ns)
        summary_raw = desc.text if desc is not None else ""
        summary = clean_html(summary_raw) or title

        # Published date
        pub = entry.find("pubDate") or entry.find("published") or entry.find("atom:published", ns)
        pub_str = pub.text.strip() if pub is not None and pub.text else datetime.now(timezone.utc).isoformat()

        # Full text for extraction
        full_text = f"{title} {summary}"

        disease = extract_disease(full_text, disease_hint)
        if not disease:
            continue  # skip non-disease items

        code, region, lat, lng = extract_region(full_text)
        severity = score_severity(full_text)

        items.append({
            "id": item_id(link, title),
            "source": source,
            "source_url": link,
            "disease": disease,
            "region": region,
            "country_code": code,
            "lat": lat,
            "lng": lng,
            "severity": severity,
            "title": title[:200],
            "summary": summary[:600],
            "url": link,
            "reliability": reliability,
            "published_at": pub_str[:50],
            "ingested_at": datetime.now(timezone.utc).isoformat(),
        })

    return items


# ─── Persist ─────────────────────────────────────────────────────────────────

def save_items(items: list[dict]) -> int:
    if not items:
        return 0
    conn = get_conn()
    new_count = 0
    for item in items:
        try:
            conn.execute(
                """INSERT OR IGNORE INTO feed_items
                   (id,source,source_url,disease,region,country_code,lat,lng,
                    severity,title,summary,url,reliability,published_at,ingested_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (item["id"], item["source"], item["source_url"], item["disease"],
                 item["region"], item["country_code"], item["lat"], item["lng"],
                 item["severity"], item["title"], item["summary"], item["url"],
                 item["reliability"], item["published_at"], item["ingested_at"])
            )
            if conn.execute("SELECT changes()").fetchone()[0] > 0:
                new_count += 1
        except Exception as e:
            print(f"[ingestion] DB error: {e}")
    conn.commit()
    conn.close()
    return new_count


def log_run(feed_url: str, source: str, fetched: int, new: int, status: str, error: str = None):
    conn = get_conn()
    conn.execute(
        """INSERT INTO ingestion_log (feed_url,source,items_fetched,items_new,status,error_msg,ran_at)
           VALUES (?,?,?,?,?,?,?)""",
        (feed_url, source, fetched, new, status, error, datetime.now(timezone.utc).isoformat())
    )
    conn.commit()
    conn.close()


# ─── Main ingestion loop ──────────────────────────────────────────────────────

def ingest_once():
    print(f"[ingestion] starting ingest run at {datetime.now(timezone.utc).isoformat()}")
    total_new = 0
    for feed in FEEDS:
        url = feed["url"]
        source = feed["source"]
        try:
            root = fetch_rss(url)
            if root is None:
                log_run(url, source, 0, 0, "error", "fetch failed")
                continue
            items = parse_items(root, feed)
            new = save_items(items)
            total_new += new
            log_run(url, source, len(items), new, "ok")
            print(f"[ingestion] {source}: {len(items)} parsed, {new} new")
        except Exception as e:
            print(f"[ingestion] error for {source}: {e}")
            log_run(url, source, 0, 0, "error", str(e))
        time.sleep(0.5)  # polite delay
    print(f"[ingestion] run complete — {total_new} new items total")
    return total_new


def start_background_worker(interval_seconds: int = 300):
    """Start the ingestion loop in a background daemon thread."""
    def loop():
        # Initial run immediately
        try:
            ingest_once()
        except Exception as e:
            print(f"[ingestion] initial run error: {e}")
        while True:
            time.sleep(interval_seconds)
            try:
                ingest_once()
            except Exception as e:
                print(f"[ingestion] loop error: {e}")

    t = threading.Thread(target=loop, daemon=True, name="ingestion-worker")
    t.start()
    print(f"[ingestion] background worker started (interval={interval_seconds}s)")
    return t


def get_ingestion_status() -> dict:
    conn = get_conn()
    try:
        last = conn.execute(
            "SELECT * FROM ingestion_log ORDER BY ran_at DESC LIMIT 1"
        ).fetchone()
        total_items = conn.execute("SELECT COUNT(*) FROM feed_items").fetchone()[0]
        last_24h = conn.execute(
            "SELECT COUNT(*) FROM feed_items WHERE ingested_at > datetime('now', '-24 hours')"
        ).fetchone()[0]
        sources = conn.execute(
            "SELECT source, COUNT(*) as cnt FROM feed_items GROUP BY source ORDER BY cnt DESC"
        ).fetchall()
        return {
            "last_run": dict(last) if last else None,
            "total_items": total_items,
            "last_24h": last_24h,
            "sources": [dict(s) for s in sources],
        }
    finally:
        conn.close()


if __name__ == "__main__":
    from database import init_db
    init_db()
    ingest_once()
