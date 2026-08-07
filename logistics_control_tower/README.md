# Enterprise AI Logistics Control Tower

A production-ready AI Routing Platform designed for the Amazon Last Mile Routing challenge. This platform combines a mathematical optimization engine (Google OR-Tools) with a modular Indian constraint system and an interactive React AI Copilot Dashboard.

## 📂 Project Structure

```text
logistics_control_tower/
│
├── api/                  # FastAPI REST endpoints serving the frontend
├── constraints/          # Independent Plugin Engine (Capacity, Time Windows, etc.)
├── core/                 # Core Data Models (Package, Route, Stop) & Interfaces
├── engines/              # AI/Math Engines (OR-Tools, Greedy, Events, Explainability)
├── frontend/             # React SPA (Vite + TailwindCSS + Leaflet + Recharts)
├── tests/                # Automated pytest suites for constraints
│
├── start_tower.bat       # Single-click launcher for Windows
├── main.py               # CLI testing script (headless pipeline run)
├── requirements.txt      # Python dependencies
└── README.md             # This file
```

## 🚀 Quick Start

**1. Install Dependencies**
```bash
# Backend (Python 3.9+)
pip install -r requirements.txt

# Frontend (Node.js 18+)
cd frontend
npm install
cd ..
```

**2. Launch the Application**
If you are on Windows, simply double-click `start_tower.bat`.

Alternatively, start them manually:
- **Backend:** `uvicorn api.app:app --reload`
- **Frontend:** `cd frontend && npm run dev`

## 🧩 Architectural Highlights

- **SOLID Principles:** The OR-Tools `RouteOptimizer` is completely decoupled from business logic. It relies on the `ValidationEngine` to pre-filter and repair constraint violations using the `IConstraint` plugin contract.
- **Incremental Replanning:** The `EventEngine` handles dynamic perturbations (New Pickups, Traffic) by calculating deltas, drastically reducing computational overhead.
- **AI Explainability:** Instead of generic alerts, the backend generates highly structured JSON explaining *why* a route changed, which constraints were triggered, and the ETA business impact.
- **Beautiful UI:** A dynamic React Dashboard utilizing `react-router-dom`, `recharts` for AI benchmarking (Greedy vs OR-Tools), and `react-leaflet` for OpenStreetMap visualization.
