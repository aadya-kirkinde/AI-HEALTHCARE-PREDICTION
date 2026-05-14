# OutbreakOS · Global Outbreak Intelligence Platform

Real-time disease outbreak monitoring, intelligence analysis, and threat tracking system. Built for public health analysts, biosecurity teams, and epidemiologists.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React 18)                       │
│   Landing → Console (Map · Feed · Intel · Timeline ·       │
│             Architecture · Sources)                         │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP REST
┌──────────────────────▼──────────────────────────────────────┐
│               Backend (FastAPI / Python)                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  Ingestion  │  │    RAG      │  │   Intelligence      │ │
│  │  Workers    │  │  (ChromaDB) │  │   Query Engine      │ │
│  │  WHO/CDC/   │  │  Vector    │  │   Ollama LLM        │ │
│  │  ECDC/ProMED│  │  Embeddings │  │   Fallback mock     │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│                      │                                      │
│              ┌───────▼────────┐                            │
│              │    SQLite      │                            │
│              │  Feed Items    │                            │
│              │  Outbreaks     │                            │
│              └────────────────┘                            │
└─────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, MapLibre GL, Three.js Globe, Babel (in-browser), bcryptjs |
| Backend | FastAPI, Python 3.12, Uvicorn |
| Database | SQLite (WAL mode), ChromaDB (vector store) |
| AI | Ollama (llama3.2 + nomic-embed-text) |
| Map | CARTO/OSM tiles via MapLibre GL |
| Deployment | Vercel (frontend), on-prem (backend) |

## Quick Start

### Frontend Only (static)
```bash
cd outbreakos
python -m http.server 5173
# Open http://localhost:5173
```

### With Backend
```bash
# Terminal 1
cd outbreakos/backend
python -m uvicorn server:app --port 8000 --reload

# Terminal 2
cd outbreakos
python -m http.server 5173
# Open http://localhost:5173
```

### Demo Credentials
```
Email:    demo@outbreakos.dev
Password: demo1234
```

## Project Structure

```
outbreakos/
├── index.html              # Entry point
├── App.jsx                 # Main React application
├── LoginView.jsx           # Authentication UI
├── SignupView.jsx          # Registration UI
├── SettingsDrawer.jsx      # User settings panel
├── MapPanel.jsx            # MapLibre GL globe & map
├── auth.js                 # Client-side auth (bcryptjs + localStorage)
├── globe.js                # Three.js 3D globe
├── app.css                 # All styles
├── colors_and_type.css     # Design tokens & typography
├── assets/                # Static assets (logo, etc.)
└── backend/
    ├── server.py           # FastAPI application
    ├── database.py         # SQLite + ChromaDB setup
    ├── ingestion.py        # RSS feed ingestion workers
    ├── rag.py             # RAG query engine
    ├── requirements.txt   # Python dependencies
    ├── start.sh           # Linux/macOS startup script
    └── start.bat           # Windows startup script
```

## Features

- **Live Threat Radar** — Real-time outbreak tracking with severity scoring
- **Interactive Globe** — 3D WebGL globe with outbreak arcs and country highlights
- **Situation Feed** — Continuous ingest from WHO, CDC, ECDC, ProMED, and 140+ RSS sources
- **Intelligence Console** — RAG-grounded natural language query against outbreak database
- **Timeline View** — Chronological outbreak progression with source attribution
- **Architecture Dashboard** — System design documentation embedded in the app
- **Source Health Monitor** — Ingestion status, freshness, and reliability tracking

## Environment Variables (Backend)

```env
OLLAMA_BASE_URL=http://localhost:11434
DATABASE_PATH=outbreak.db
INGEST_INTERVAL=300
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | System health status |
| `/api/outbreaks` | GET | All active outbreaks |
| `/api/feed` | GET | Feed items with pagination |
| `/api/timeline` | GET | Timeline events |
| `/api/sources` | GET | Source registry |
| `/api/ingest/status` | GET | Ingestion worker status |
| `/api/ingest/trigger` | POST | Trigger manual ingestion |
| `/api/intel/query` | POST | RAG-grounded intelligence query |

## Deployment

### Frontend (Vercel)
The frontend is a static SPA. Deploy to Vercel with zero configuration:
```bash
vercel --prod
```

### Backend (On-Prem)
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn server:app --port 8000
```

> Note: The backend AI features (Ollama) require a local or network-accessible Ollama instance. Without Ollama, the system falls back to keyword search.

## License

MIT
