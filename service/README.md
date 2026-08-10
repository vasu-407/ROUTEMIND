# RouteMind AI 🚀 

**RouteMind AI** is an intelligent, real-time Logistics Control Tower built to tackle complex last-mile delivery challenges. It combines **Operations Research (OR-Tools)** for dynamic routing, **Machine Learning (XGBoost)** for predictive telemetry, and **Generative AI (Gemini)** for explainable supervisor decision-making. 

This project was built to process real-world Amazon Last-Mile dataset routes and elegantly handle real-world supply chain anomalies.

![RouteMind Dashboard](https://img.shields.io/badge/Status-Active-brightgreen) ![License](https://img.shields.io/badge/License-MIT-blue)

---

## 🌟 Key Features

### 1. Logistics Control Tower (Frontend)
- **Interactive 2D Visualization**: A clean Leaflet map that visualizes the depot, delivery stops, vehicles, and real-time events.
- **Dynamic Polyline Rendering**: Visually compare the **Original Route** (dashed) against the **AI Proposed Route** (solid) side-by-side during replanning.
- **Offline Driver Mode**: A fully offline-capable Progressive Web App (PWA) that caches map boundaries and route sequences, allowing drivers to continue navigating even in dead zones.

### 2. Autonomous Event Engine & Simulation
Real-time monitoring engine capable of detecting and reacting to:
- 🚦 **Traffic Delays**
- 🚧 **Road Closures**
- 📦 **Failed Deliveries & New Pickups**
- 🚚 **Vehicle Breakdowns**
- 🏭 **Hub Congestion**

### 3. AI-Powered Replanning (Backend)
- **Constraint Engine + OR-Tools**: Instantly recalculates the most optimal route when a disruption occurs, respecting vehicle capacity, time windows, and shift limits.
- **XGBoost Telemetry**: Predicts accurate travel times and anomaly risks based on historical data.

### 4. Human-in-the-Loop Supervisor Console
- **Explainable AI (Gemini)**: When the system proposes a route change, Gemini analyzes the underlying OR-Tools metrics and explains to the human supervisor exactly *why* the route changed, and what the business impact is (ETA differences, distance saved).
- **One-Click Dispatch**: Supervisors review the AI's recommendation, approve the feasibility check, and instantly dispatch the new route to the offline Driver Mode.

---

## 🏗️ System Architecture

The application is split into specialized microservices to ensure performance and scalability:

```text
├── frontend/                 # React + Vite + Tailwind + MapLibre GL (PWA)
├── backend/                  # Node.js + Express (Event Management & Dashboard API)
├── api/                      # FastAPI (Core Routing & OR-Tools Engine)
├── ml/                       # Python (XGBoost Models & Inference API)
└── core/                     # Shared configurations and Constraint Engines
```

### Flow of Execution:
1. **Event Detected**: Simulation engine triggers a disruption (e.g., Traffic on Segment A -> B).
2. **Impact Analysis**: The ML Engine evaluates the delay severity.
3. **Optimization**: FastAPI requests a new route from OR-Tools avoiding the affected segment.
4. **Explanation**: Gemini generates a human-readable explanation of the OR-Tools delta.
5. **Approval**: The Supervisor approves the change in the React frontend.
6. **Dispatch**: The offline-resilient Driver App seamlessly updates via `localStorage` synchronization.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- Python (3.10+)
- `curl` (for testing API endpoints)

### 1. Start the ML & Routing Backend (Python)
```bash
# Start the FastAPI core routing server
cd api
uvicorn app:app --host 0.0.0.0 --port 8000

# Start the ML Inference server
cd ../ml
python ml_api.py
```

### 2. Start the API Gateway (Node.js)
```bash
cd backend
npm install
node src/app.js
```
*(Runs on `http://localhost:3000`)*

### 3. Start the Frontend (Vite + React)
```bash
cd frontend
npm install
npm run dev
```
*(Runs on `http://localhost:5173`)*

> **Note:** If you experience issues with the 3D map failing to load, try clearing the Vite cache using `npm run dev -- --force`.

---

## 🗺️ Map Configuration

The frontend uses standard Leaflet vector maps. The visualization logic is handled entirely inside the `MapViewer.jsx` component. No API tokens are required.

---

## 💡 Hackathon Demo Script

To show off the full power of RouteMind AI during a presentation:
1. Open the **Route Planner** and select a route (e.g., Route 1 with 119 stops).
2. Click **Analyze Route** to open the **Simulation** view.
3. Click **Force Demo Traffic Event**. The map will automatically highlight the affected segment.
4. Switch to the **Supervisor Console**. You will see the dashed old route vs. the solid proposed route.
5. Highlight the **Gemini AI Explanation** on the right side.
6. Click **Approve & Dispatch**.
7. The view will switch to **Driver Mode**, demonstrating how the updated route propagates directly to the driver's offline map.

---

## 🛠️ Built With
* **Frontend**: React, Vite, Tailwind CSS, Leaflet, react-leaflet, Lucide Icons, Vite-PWA
* **Backend**: Node.js, Express, Python, FastAPI
* **AI & Optimization**: Google OR-Tools, XGBoost, Google Gemini API
* **Geospatial**: OpenStreetMap, OSRM (Open Source Routing Machine)
