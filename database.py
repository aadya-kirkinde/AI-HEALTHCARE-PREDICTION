"""OutbreakOS — SQLite database schema and helpers."""

import sqlite3
import json
from pathlib import Path
from datetime import datetime, timezone

DB_PATH = Path(__file__).parent / "outbreak.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS feed_items (
    id            TEXT PRIMARY KEY,
    source        TEXT NOT NULL,
    source_url    TEXT,
    disease       TEXT,
    region        TEXT,
    country_code  TEXT,
    lat           REAL,
    lng           REAL,
    severity      INTEGER DEFAULT 1,
    title         TEXT,
    summary       TEXT,
    url           TEXT,
    reliability   TEXT DEFAULT 'MEDIA',
    published_at  TEXT,
    ingested_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS outbreaks (
    id            TEXT PRIMARY KEY,
    disease       TEXT NOT NULL,
    region        TEXT,
    country       TEXT,
    country_code  TEXT,
    lat           REAL,
    lng           REAL,
    cases         INTEGER DEFAULT 0,
    deaths        INTEGER DEFAULT 0,
    delta_7d      REAL DEFAULT 0.0,
    severity      INTEGER DEFAULT 1,
    status        TEXT DEFAULT 'MONITORING',
    source        TEXT,
    source_url    TEXT,
    summary       TEXT,
    reliability   TEXT DEFAULT 'OFFICIAL',
    first_seen    TEXT,
    updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS timeline_events (
    id            TEXT PRIMARY KEY,
    outbreak_id   TEXT,
    event_type    TEXT,
    label         TEXT,
    at_pct        REAL,
    severity      INTEGER DEFAULT 1,
    date          TEXT,
    description   TEXT,
    source        TEXT
);

CREATE TABLE IF NOT EXISTS ingestion_log (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    feed_url      TEXT,
    source        TEXT,
    items_fetched INTEGER DEFAULT 0,
    items_new     INTEGER DEFAULT 0,
    status        TEXT DEFAULT 'ok',
    error_msg     TEXT,
    ran_at        TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_feed_ingested ON feed_items(ingested_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_disease  ON feed_items(disease);
CREATE INDEX IF NOT EXISTS idx_feed_severity ON feed_items(severity DESC);
CREATE INDEX IF NOT EXISTS idx_outbreak_sev  ON outbreaks(severity DESC);
"""

SEED_OUTBREAKS = [
    {
        "id": "KHM-PP-2026-0143",
        "disease": "H5N1",
        "region": "Cambodia · Phnom Penh",
        "country": "Cambodia",
        "country_code": "KHM",
        "lat": 11.5564,
        "lng": 104.9282,
        "cases": 247,
        "deaths": 3,
        "delta_7d": 12.4,
        "severity": 3,
        "status": "WARNING",
        "source": "WHO",
        "source_url": "https://www.who.int/emergencies/disease-outbreak-news",
        "summary": "3 confirmed H5N1 cases in Phnom Penh province. All linked to backyard poultry exposure. Contact tracing for 41 individuals.",
        "reliability": "OFFICIAL",
        "first_seen": "2026-05-08T11:14:00Z",
        "updated_at": "2026-05-08T14:22:00Z",
    },
    {
        "id": "COD-KN-2026-0291",
        "disease": "Mpox",
        "region": "DR Congo · North Kivu",
        "country": "DR Congo",
        "country_code": "COD",
        "lat": -1.6601,
        "lng": 29.2200,
        "cases": 1983,
        "deaths": 67,
        "delta_7d": 28.1,
        "severity": 4,
        "status": "CRITICAL",
        "source": "CDC",
        "source_url": "https://www.cdc.gov/poxvirus/mpox/",
        "summary": "Mpox clade Ib cluster; 14-day rolling average still doubling. WHO coordinates vaccine shipment to Goma.",
        "reliability": "OFFICIAL",
        "first_seen": "2026-05-08T09:00:00Z",
        "updated_at": "2026-05-08T13:58:00Z",
    },
    {
        "id": "ESP-TF-2026-0599",
        "disease": "Hantavirus",
        "region": "Spain · Tenerife (MV Hondius cruise)",
        "country": "Spain",
        "country_code": "ESP",
        "lat": 28.4636,
        "lng": -16.2518,
        "cases": 6,
        "deaths": 0,
        "delta_7d": 0.0,
        "severity": 3,
        "status": "WARNING",
        "source": "WHO",
        "source_url": "https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON599",
        "summary": "WHO DON599: 6 confirmed Hantavirus (Andes strain) cases linked to MV Hondius cruise ship. Probable exposure: Patagonia region, Argentina. Disembarked Tenerife May 2026. ECDC assessment: low general public risk. Rodent exposure the likely route. No confirmed human-to-human Andes transmission.",
        "reliability": "OFFICIAL",
        "first_seen": "2026-05-08T06:00:00Z",
        "updated_at": "2026-05-08T14:00:00Z",
    },
    {
        "id": "ZAF-CP-2026-0012",
        "disease": "Hantavirus",
        "region": "South Africa · Cape Town",
        "country": "South Africa",
        "country_code": "ZAF",
        "lat": -33.9249,
        "lng": 18.4241,
        "cases": 2,
        "deaths": 0,
        "delta_7d": 0.0,
        "severity": 2,
        "status": "MONITORING",
        "source": "Reuters",
        "source_url": "https://www.reuters.com/business/healthcare-pharmaceuticals/who-reports-six-confirmed-hantavirus-cases-tied-spain-bound-cruise-2026-05-08/",
        "summary": "2 passengers from MV Hondius requiring medical evacuation to South Africa hospitals. ECDC monitoring international case distribution from cruise cluster.",
        "reliability": "MEDIA",
        "first_seen": "2026-05-08T08:30:00Z",
        "updated_at": "2026-05-08T12:00:00Z",
    },
    {
        "id": "ROU-BU-2026-0078",
        "disease": "Measles",
        "region": "Romania · Bucharest",
        "country": "Romania",
        "country_code": "ROU",
        "lat": 44.4268,
        "lng": 26.1025,
        "cases": 47,
        "deaths": 0,
        "delta_7d": -3.1,
        "severity": 2,
        "status": "ADVISORY",
        "source": "ECDC",
        "source_url": "https://www.ecdc.europa.eu/en/measles",
        "summary": "School-cohort outbreak; catch-up vaccination campaign covers ~70% of at-risk cohort. Trend declining.",
        "reliability": "OFFICIAL",
        "first_seen": "2026-04-28T00:00:00Z",
        "updated_at": "2026-05-08T13:41:00Z",
    },
    {
        "id": "USA-CA-2026-0011",
        "disease": "H5N1",
        "region": "USA · California",
        "country": "United States",
        "country_code": "USA",
        "lat": 36.7783,
        "lng": -119.4179,
        "cases": 89,
        "deaths": 0,
        "delta_7d": 4.7,
        "severity": 3,
        "status": "WARNING",
        "source": "CDC",
        "source_url": "https://www.cdc.gov/flu/avianflu/",
        "summary": "Dairy cattle herd no. CA-DA-211 confirmed positive. Worker testing initiated for 88 contacts.",
        "reliability": "OFFICIAL",
        "first_seen": "2026-04-10T00:00:00Z",
        "updated_at": "2026-05-08T13:22:00Z",
    },
    {
        "id": "ARG-BA-2026-0044",
        "disease": "Hantavirus",
        "region": "Argentina · Buenos Aires",
        "country": "Argentina",
        "country_code": "ARG",
        "lat": -34.6118,
        "lng": -58.3960,
        "cases": 12,
        "deaths": 1,
        "delta_7d": 0.0,
        "severity": 2,
        "status": "MONITORING",
        "source": "PAHO",
        "source_url": "https://www.paho.org/en/topics/hantavirus",
        "summary": "12 suburban HPS cases; rodent surveillance activated; no cluster spread pattern observed.",
        "reliability": "OFFICIAL",
        "first_seen": "2026-05-01T00:00:00Z",
        "updated_at": "2026-05-08T12:48:00Z",
    },
    {
        "id": "IDN-JK-2026-0102",
        "disease": "H5N1",
        "region": "Indonesia · Jakarta",
        "country": "Indonesia",
        "country_code": "IDN",
        "lat": -6.2088,
        "lng": 106.8456,
        "cases": 5,
        "deaths": 0,
        "delta_7d": 2.0,
        "severity": 2,
        "status": "MONITORING",
        "source": "Kemkes",
        "source_url": "https://www.kemkes.go.id",
        "summary": "Cluster of 5 suspected cases under investigation. Genomic results pending; no h2h evidence.",
        "reliability": "OFFICIAL",
        "first_seen": "2026-05-06T00:00:00Z",
        "updated_at": "2026-05-08T12:31:00Z",
    },
    {
        "id": "SAU-RY-2026-0016",
        "disease": "MERS-CoV",
        "region": "Saudi Arabia · Riyadh",
        "country": "Saudi Arabia",
        "country_code": "SAU",
        "lat": 24.6877,
        "lng": 46.7219,
        "cases": 3,
        "deaths": 0,
        "delta_7d": 0.0,
        "severity": 2,
        "status": "MONITORING",
        "source": "WHO",
        "source_url": "https://www.who.int/emergencies/mers-cov",
        "summary": "3 cases linked to dromedary contact. No nosocomial transmission. Routine zoonotic surveillance.",
        "reliability": "OFFICIAL",
        "first_seen": "2026-05-07T00:00:00Z",
        "updated_at": "2026-05-08T11:09:00Z",
    },
]

SEED_TIMELINE = [
    {"id": "tl-001", "outbreak_id": "KHM-PP-2026-0143", "event_type": "advisory", "label": "Q1 · Cambodia poultry advisory", "at_pct": 8, "severity": 2, "date": "2025-11-15", "source": "WHO"},
    {"id": "tl-002", "outbreak_id": "USA-CA-2026-0011", "event_type": "index_case", "label": "Mar 12 · CA dairy cattle index case", "at_pct": 22, "severity": 3, "date": "2026-03-12", "source": "CDC"},
    {"id": "tl-003", "outbreak_id": "COD-KN-2026-0291", "event_type": "spread", "label": "Apr 4 · Mpox clade Ib expands to Burundi", "at_pct": 41, "severity": 3, "date": "2026-04-04", "source": "CDC"},
    {"id": "tl-004", "outbreak_id": "COD-KN-2026-0291", "event_type": "pheic", "label": "Apr 22 · WHO PHEIC consultation", "at_pct": 58, "severity": 4, "date": "2026-04-22", "source": "WHO"},
    {"id": "tl-005", "outbreak_id": "ESP-TF-2026-0599", "event_type": "index_case", "label": "May 6 · WHO DON599: 6 Hantavirus cases on MV Hondius", "at_pct": 63, "severity": 3, "date": "2026-05-06", "source": "WHO", "description": "WHO Disease Outbreak News published. 6 confirmed Hantavirus (Andes strain) cases linked to cruise ship MV Hondius. Probable exposure in Patagonia, Argentina. Disembarked in Tenerife, Canary Islands."},
    {"id": "tl-006", "outbreak_id": "ESP-TF-2026-0599", "event_type": "spread", "label": "May 7 · ECDC assessment: low public risk", "at_pct": 67, "severity": 2, "date": "2026-05-07", "source": "ECDC", "description": "ECDC releases technical assessment. Confirms Andes strain of Hantavirus. Rodent exposure most likely route. No evidence of sustained human-to-human transmission. Low general public risk."},
    {"id": "tl-007", "outbreak_id": "ZAF-CP-2026-0012", "event_type": "travel", "label": "May 8 · 2 passengers medical evacuation to South Africa", "at_pct": 70, "severity": 2, "date": "2026-05-08", "source": "Reuters", "description": "Reuters reports 2 MV Hondius passengers requiring medical evacuation to South Africa hospitals. International case distribution monitoring underway."},
    {"id": "tl-008", "outbreak_id": "ESP-TF-2026-0599", "event_type": "policy", "label": "May 8 · International contact tracing initiated", "at_pct": 72, "severity": 2, "date": "2026-05-08", "source": "WHO", "description": "WHO coordinates international contact tracing for cruise ship passengers. NNVHA notifies health authorities across disembarkation ports. Science Media Centre releases expert reactions."},
    {"id": "tl-009", "outbreak_id": "KHM-PP-2026-0143", "event_type": "active", "label": "May 8 · KHM-PP-2026-0143 (now)", "at_pct": 78, "severity": 3, "date": "2026-05-08", "source": "WHO"},
    {"id": "tl-010", "outbreak_id": "IDN-JK-2026-0102", "event_type": "forecast", "label": "Forecast · IDN cluster outcome", "at_pct": 88, "severity": 2, "date": "2026-06-01", "source": "WHO"},
]


def get_conn():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_conn()
    conn.executescript(SCHEMA)

    # Seed outbreaks if empty
    cur = conn.execute("SELECT COUNT(*) FROM outbreaks")
    if cur.fetchone()[0] == 0:
        for o in SEED_OUTBREAKS:
            conn.execute(
                """INSERT OR IGNORE INTO outbreaks
                   (id,disease,region,country,country_code,lat,lng,cases,deaths,delta_7d,severity,
                    status,source,source_url,summary,reliability,first_seen,updated_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (o["id"], o["disease"], o["region"], o["country"], o["country_code"],
                 o["lat"], o["lng"], o["cases"], o["deaths"], o["delta_7d"], o["severity"],
                 o["status"], o["source"], o["source_url"], o["summary"], o["reliability"],
                 o["first_seen"], o["updated_at"])
            )

    # Seed timeline if empty
    cur = conn.execute("SELECT COUNT(*) FROM timeline_events")
    if cur.fetchone()[0] == 0:
        for t in SEED_TIMELINE:
            conn.execute(
                """INSERT OR IGNORE INTO timeline_events
                   (id,outbreak_id,event_type,label,at_pct,severity,date,source)
                   VALUES (?,?,?,?,?,?,?,?)""",
                (t["id"], t["outbreak_id"], t["event_type"], t["label"],
                 t["at_pct"], t["severity"], t["date"], t["source"])
            )

    conn.commit()
    conn.close()
