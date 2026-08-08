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

## Track 3 MVP: adaptive, explainable routing

This MVP uses the Amazon Last Mile Routing Research Challenge data to prove the routing workflow. The source data is US-based; Indian delivery constraints are intentionally encoded as configurable business rules for the demonstration.

```text
React control tower -> Node.js API gateway -> FastAPI routing service
                                              |        |          |
                                           Rules   OR-Tools   ML travel-time service
                                              |
                         Feasibility check -> candidate replan -> supervisor approval -> active route
```

### AI and optimization workflow

1. A greedy nearest-neighbour route establishes the baseline.
2. OR-Tools solves the constrained route; optional XGBoost predictions supply travel-time estimates.
3. The system evaluates distance, ETA, fuel and constraint results against the baseline.
4. A new pickup, failed delivery, traffic delay or road closure creates a **candidate** route. The active route is not changed automatically.
5. Rules-based explainability (with an optional Gemini enhancer) produces the supervisor explanation. The Supervisor Console must approve before the candidate replaces the active route.

### Constraints and guardrails

- Vehicle capacity and COD cash-carry limit.
- Delivery/zone timing, truck-entry timing and driver working-hour checks.
- Replanning is capped by the OR-Tools five-second solver budget, below the 30-second demo requirement for tens to low hundreds of stops.
- Analytics reports baseline-vs-OR-Tools savings and an estimated CPU-time compute cost per route. Heavy ML/LLM calls are optional enrichment, not required for the solver path.
- The dashboard caches the most recently loaded route map in browser storage, so a partner can still view the last usable route during a connectivity interruption.

### Eight-minute demo flow

1. Show the real dataset route on the OpenStreetMap dashboard.
2. Run the optimizer and compare it with the greedy baseline in Analytics.
3. Inject a new pickup or failed-delivery event in Simulation.
4. Show the before/after impact and feasibility self-check.
5. Approve or reject the candidate in Supervisor Console.
6. Close with cost per route, offline cache, and the TMS/fleet/hub integration path.
