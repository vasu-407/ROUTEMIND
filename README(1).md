# 🚚 RouteMind AI

### Adaptive Route Optimization & Real-Time Replanning for Modern Supply Chains

<p align="center">
  <b>From static night-before planning → to an intelligent, explainable logistics control tower.</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-18+-61DAFB?logo=react&logoColor=black" alt="React"/>
  <img src="https://img.shields.io/badge/Node.js-Express-339933?logo=node.js&logoColor=white" alt="Node.js"/>
  <img src="https://img.shields.io/badge/MongoDB-Database-47A248?logo=mongodb&logoColor=white" alt="MongoDB"/>
  <img src="https://img.shields.io/badge/Python-ML%20%2B%20Optimization-3776AB?logo=python&logoColor=white" alt="Python"/>
  <img src="https://img.shields.io/badge/XGBoost-Travel%20Time%20Prediction-FF6F00" alt="XGBoost"/>
  <img src="https://img.shields.io/badge/OR--Tools-Route%20Optimization-4285F4" alt="OR-Tools"/>
  <img src="https://img.shields.io/badge/Gemini-AI%20Explainability-8E75B2" alt="Gemini"/>
  <img src="https://img.shields.io/badge/OpenStreetMap-Mapping-7EBC6F?logo=openstreetmap&logoColor=white" alt="OpenStreetMap"/>
</p>

---

## 🧭 What is RouteMind AI?

**RouteMind AI** is an AI-assisted logistics control tower designed to solve a critical problem in first-mile, middle-mile, and last-mile transportation:

> **What happens when the plan changes after the vehicle is already on the road?**

Traditional route planning often creates a route once and leaves supervisors to manually react when reality changes.

RouteMind continuously connects:

**historical routing data + ML travel-time prediction + business constraints + mathematical optimization + event-driven replanning + AI explanations**

to help logistics supervisors make faster, safer and more explainable routing decisions.

---

## 🎯 The Problem

A route that looks optimal at 8:00 AM can become inefficient at 10:30 AM.

A new pickup arrives.

A delivery fails.

Traffic builds up.

A vehicle breaks down.

A road becomes unavailable.

A hub becomes congested.

Without dynamic replanning, one disruption can cascade into:

- ⏱️ Late deliveries
- 🚚 Poor vehicle utilization
- ⛽ Higher fuel consumption
- 🔄 Unnecessary backtracking
- 📦 Missed delivery windows
- 💰 Higher operational cost
- 👨‍💼 More manual work for supervisors

**RouteMind turns these disruptions into actionable route decisions.**

---

# 🧠 Our Core Idea

RouteMind does **not** ask an LLM to solve routing.

Instead, each technology has a clearly defined responsibility:

| Layer | Responsibility |
|---|---|
| 🗃️ Amazon Dataset | Historical operational routing data |
| 🤖 XGBoost | Predict realistic travel times |
| 📋 Constraint Engine | Enforce logistics/business rules |
| 🧮 OR-Tools | Compute feasible optimized routes |
| ⚡ Event Engine | Detect and process route disruptions |
| 🔄 Replanner | Generate updated route proposals |
| ✨ Gemini | Explain the decision and recommend action |
| 🗺️ OpenStreetMap | Geographic visualization/context |
| 👨‍💼 Supervisor | Approves or rejects route changes |

### The principle

> **Classical optimization makes the route decision. AI makes the decision understandable and actionable.**

---

# 🏗️ System Architecture

```text
                         ┌──────────────────────┐
                         │   Amazon Route Data  │
                         │ Routes • Stops •     │
                         │ Packages • Travel    │
                         │ Times • Sequences    │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │ Data Preprocessing   │
                         │ + Feature Engineering│
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │       XGBoost        │
                         │ Travel-Time          │
                         │ Prediction            │
                         └──────────┬───────────┘
                                    │
                         Predicted Travel Times
                                    │
                                    ▼
┌──────────────────────┐   ┌──────────────────────┐
│ Indian Constraint    │──▶│   Google OR-Tools    │
│ Engine               │   │   Route Optimizer    │
│                      │   │                      │
│ • Capacity           │   │ • Route sequence     │
│ • Delivery windows   │   │ • Travel time        │
│ • Driver hours       │   │ • Capacity           │
│ • COD limits         │   │ • Feasibility        │
│ • Zone timing        │   │                      │
└──────────────────────┘   └──────────┬───────────┘
                                      │
                                      ▼
                           ┌──────────────────────┐
                           │   Optimized Route    │
                           └──────────┬───────────┘
                                      │
                                      ▼
                           ┌──────────────────────┐
                           │     Event Engine     │
                           │                      │
                           │ New Pickup            │
                           │ Failed Delivery       │
                           │ Traffic Delay         │
                           │ Vehicle Breakdown     │
                           │ Road Closure          │
                           │ Hub Congestion        │
                           └──────────┬───────────┘
                                      │
                                      ▼
                           ┌──────────────────────┐
                           │ Incremental Replanner│
                           └──────────┬───────────┘
                                      │
                                      ▼
                           ┌──────────────────────┐
                           │   Gemini AI Agent    │
                           │                      │
                           │ Why? What changed?   │
                           │ Impact? What next?   │
                           └──────────┬───────────┘
                                      │
                                      ▼
                         ┌────────────────────────┐
                         │ Supervisor Control     │
                         │ Tower                  │
                         │                        │
                         │ Approve / Reject       │
                         └──────────┬─────────────┘
                                    │
                                    ▼
                         ┌────────────────────────┐
                         │ React + 3D Map / OSM   │
                         │ Route + Events + KPIs  │
                         └────────────────────────┘
```

---

# 🚀 What Makes RouteMind Different?

## 1. 🔮 Predictive Routing

Instead of relying only on static/historical travel times, RouteMind uses **XGBoost** to estimate travel time from route features.

Example:

```text
Distance
Departure Time
Stop Density
Service Time
Vehicle Capacity
Zone
Package Characteristics
        ↓
     XGBoost
        ↓
Predicted Travel Time
```

These predictions can then be supplied to the optimizer.

---

## 2. 🧮 AI + Classical Optimization

RouteMind deliberately avoids using an expensive LLM for routine route calculation.

### Routine decision

```text
XGBoost → Constraint Engine → OR-Tools
```

### Exception

```text
Event → Replan → Gemini Explanation
```

This provides a better balance between:

- Accuracy
- Speed
- Explainability
- Cost
- Reliability

---

# 🇮🇳 Indian Logistics Constraint Layer

The Amazon dataset is U.S.-based. Instead of pretending it contains Indian logistics rules, RouteMind keeps the original data intact and overlays configurable Indian constraints.

### Current constraint framework

- 🚚 Vehicle capacity
- 🕐 Delivery windows
- 👨‍✈️ Driver working hours
- 🚛 Truck entry timing / zone restrictions
- 💵 COD cash-carry limits
- 📦 Priority deliveries
- ⏱️ Maximum route duration
- 🏢 Depot start/end rules

Each constraint is evaluated before a proposed route is approved.

---

# ⚡ Real-Time Replanning

RouteMind is built around the idea that **a route is not finished when it leaves the depot**.

### Example

Initial route:

```text
Depot
  ↓
A
  ↓
B
  ↓
C
  ↓
D
  ↓
E
```

A traffic disruption occurs between `B → C`.

RouteMind:

```text
Traffic Event
     ↓
Affected Route
     ↓
Impact Analysis
     ↓
OR-Tools
     ↓
New Proposed Sequence
     ↓
Gemini Explanation
     ↓
Supervisor Approval
     ↓
Driver Notification
```

The system targets the hackathon requirement of returning a re-plan in **under 30 seconds** on a realistic demo batch.

---

# 🤖 RouteMind AI Agent

The AI agent is a **decision-support layer**, not a black-box routing engine.

It answers:

### Why did the route change?

> Heavy traffic was detected on the affected segment, increasing expected travel time. The optimizer proposed an alternate sequence while keeping the configured delivery and vehicle constraints feasible.

### What changed?

```text
Before:
A → B → C → D

After:
A → C → B → D
```

### What is the impact?

```text
Distance: +2.1 km
ETA:       +4 min
Capacity:  PASS
COD:       PASS
Windows:   PASS
```

### What should the supervisor do?

> **Approve the proposed route.**

### What should the driver receive?

> Traffic detected ahead. Follow the approved updated sequence.

---

# 🗺️ Professional Route Visualization

The control tower is designed to visualize:

- 🏢 Depot
- 🚚 Vehicle
- 🔢 Stop sequence
- 🟠 New pickup
- 🔴 Failed delivery
- ⚠️ Traffic-affected segment
- 🚧 Road closure
- 🏭 Hub congestion
- Current route
- Proposed route
- Before/after changes

The map is a **visual operational layer**. It does not secretly make routing decisions.

---

# 🎮 Event Simulation

RouteMind supports controlled simulation of:

| Event | System Response |
|---|---|
| 🟠 New Pickup | Find feasible insertion / reassignment |
| 🔴 Failed Delivery | Reposition/retry stop |
| ⚠️ Traffic Delay | Replan affected route |
| 🚚 Vehicle Breakdown | Reassign remaining workload |
| 🚧 Road Closure | Avoid affected segment |
| 🏭 Hub Congestion | Resequence affected stops |

Manual simulation is useful for the hackathon demo, while the same Event Engine can also process automatically detected events.

---

# 👨‍💼 Supervisor Control Tower

Route changes are **not silently pushed** to drivers.

The supervisor sees:

```text
┌──────────────────────────────────────┐
│       ROUTE CHANGE REQUIRES REVIEW   │
├──────────────────────────────────────┤
│ Event: Heavy Traffic                 │
│ Route: Route 1                       │
│ Segment: B → C                       │
│                                      │
│ Old Distance: 102.4 km               │
│ New Distance: 104.5 km               │
│                                      │
│ Old ETA: 390 min                     │
│ New ETA: 394 min                     │
│                                      │
│ ✓ Capacity                          │
│ ✓ COD                               │
│ ✓ Delivery Windows                 │
│ ✓ Driver Hours                     │
│                                      │
│ AI: Recommend Approval               │
│                                      │
│ [ APPROVE ]       [ REJECT ]         │
└──────────────────────────────────────┘
```

Only after approval is the updated route considered active.

---

# 📊 Key Metrics

RouteMind is designed to measure the things that matter operationally:

- Route distance
- Travel time
- ETA
- Fuel estimate
- Vehicle utilization
- Capacity utilization
- Constraint compliance
- Route improvement vs. greedy baseline
- Replanning latency
- AI calls per route
- Estimated AI cost per decision

---

# 🧪 Benchmarking

A major requirement of the challenge is to demonstrate value beyond a naive baseline.

RouteMind compares:

### Greedy Baseline

**Nearest Neighbor**

vs.

### Classical Optimization

**Google OR-Tools**

vs.

### AI-enhanced workflow

**XGBoost travel-time prediction → Constraints → OR-Tools → AI explanation**

Example evaluation:

```text
                 Distance     Time       Violations
Greedy           161 km       8h20m      3
OR-Tools         148 km       7h42m      0
RouteMind AI     142 km*      7h12m*     0

*Results depend on the selected dataset route and evaluation setup.
```

**Do not put fabricated benchmark numbers in a presentation. Replace them with measured results from the actual run.**

---

# 🧰 Technology Stack

## Frontend

- React
- Vite
- Tailwind CSS
- Recharts
- Leaflet / MapLibre-compatible mapping layer
- Framer Motion

## Backend

- Node.js
- Express.js
- MongoDB
- REST APIs

## AI / ML

- Python
- XGBoost
- Gemini

## Optimization

- Google OR-Tools

## Data / Maps

- Amazon Last Mile Routing Research Challenge Dataset
- OpenStreetMap

---

# 📁 Project Structure

```text
RouteMind/
│
├── client/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── hooks/
│   │   └── ...
│   └── package.json
│
├── server/
│   ├── controllers/
│   ├── routes/
│   ├── services/
│   ├── models/
│   ├── middleware/
│   └── ...
│
├── python-optimizer/
│   ├── models/
│   ├── optimization/
│   ├── ml/
│   ├── constraints/
│   └── ...
│
├── data/
│   └── amazon-last-mile/
│
├── docs/
│   ├── architecture/
│   ├── api/
│   └── ml/
│
├── .env.example
├── README.md
└── package.json
```

> Adapt this structure to the actual repository. Do not move existing files just to match this diagram.

---

# 🔐 Security & Cost Philosophy

RouteMind follows a **cheap-first architecture**.

### We do NOT do:

```text
Every route update
      ↓
LLM
      ↓
LLM
      ↓
LLM
```

### Instead:

```text
Routine routing
      ↓
ML + Rules + OR-Tools
```

Only meaningful exceptions use:

```text
Event
 ↓
Replan
 ↓
Gemini
```

API keys remain server-side and are never exposed to the browser.

---

# 📡 Production Architecture

The hackathon MVP operates directly on the provided dataset and map resources.

A production deployment could connect RouteMind to:

```text
Transportation Management System
              │
              ▼
        RouteMind Engine
              │
       ┌──────┴──────┐
       ▼             ▼
Fleet/Driver     Hub Operations
Management       Dashboard
```

The current MVP intentionally avoids unnecessary enterprise integrations so the core routing and replanning workflow can be demonstrated reliably.

---

# 📴 Offline Resilience

For low-connectivity environments, the route should remain usable through cached route information.

The cached experience should preserve:

- Stop sequence
- Route details
- Last approved route
- Key route metrics
- Event information
- Driver instructions

A missing map tile should **not** make the operational route unusable.

---

# 🛠️ Getting Started

## 1. Clone

```bash
git clone <YOUR_REPOSITORY_URL>
cd RouteMind
```

## 2. Install frontend

```bash
cd client
npm install
```

## 3. Install backend

```bash
cd ../server
npm install
```

## 4. Install Python dependencies

```bash
cd ../python-optimizer
pip install -r requirements.txt
```

## 5. Configure environment variables

Create `.env` files based on `.env.example`.

Example:

```env
MONGODB_URI=your_mongodb_connection
GEMINI_API_KEY=your_gemini_key
GEMINI_MODEL=your_configured_model
```

**Never commit real API keys.**

## 6. Start services

Start the Node/Express backend, Python optimization/ML service, and React frontend according to the repository's current scripts.

---

# 🧪 Recommended Demo Scenario

For the strongest 8-minute hackathon demonstration:

### 01 — Select a route

```text
Route Planner
     ↓
Route 1
     ↓
Analyze Route
```

### 02 — Show the route

Display:

- Depot
- Stops
- Vehicle
- Route metrics

### 03 — Establish the baseline

Run:

```text
Greedy
   vs
OR-Tools
```

### 04 — Introduce disruption

Trigger:

> 🚨 Heavy Traffic

### 05 — Replan

```text
Event
 ↓
Impact Analysis
 ↓
OR-Tools
 ↓
Proposed Route
```

### 06 — Explain

Gemini tells the supervisor:

> What happened → Why the route changed → Impact → Recommendation

### 07 — Approve

Supervisor:

**APPROVE ROUTE**

### 08 — Show the outcome

Map updates.

Driver receives the approved instruction.

Dashboard updates the KPIs.

---

# 🏆 Hackathon Alignment

RouteMind directly addresses the challenge requirements:

| Requirement | RouteMind |
|---|---|
| Real Amazon routing data | ✅ |
| Greedy baseline | ✅ |
| Strong classical optimizer | ✅ OR-Tools |
| ML component | ✅ XGBoost |
| Indian constraints | ✅ Configurable rule layer |
| New pickup | ✅ |
| Failed delivery | ✅ |
| Traffic disruption | ✅ |
| Replanning | ✅ |
| <30 sec target | ✅ Targeted and measured |
| Explainability | ✅ Gemini |
| Supervisor approval | ✅ |
| Driver notification | ✅ |
| Offline resilience | ✅ Cached route |
| Cost awareness | ✅ AI exception-only strategy |
| Self-check | ✅ Validation layer |
| Professional visualization | ✅ |

---

# 🌟 Vision

RouteMind is built around a simple idea:

> **A logistics route should not be treated as a fixed plan. It should be treated as a living decision that adapts to reality.**

The long-term vision is a logistics control tower where:

**every disruption becomes an opportunity to optimize.**

```text
PLAN
  ↓
PREDICT
  ↓
OPTIMIZE
  ↓
MONITOR
  ↓
DETECT
  ↓
REPLAN
  ↓
EXPLAIN
  ↓
APPROVE
  ↓
EXECUTE
```

---

## 👥 Built For

**RouteMind AI — Adaptive Route Optimization for Supply Chain**

Built for the **RouteMind hackathon track: Transportation, Middle Mile & Last Mile**.

---

## 📜 Data & Attribution

RouteMind uses the **Amazon Last Mile Routing Research Challenge dataset** for routing research and demonstration.

OpenStreetMap data is used for geographic visualization/context.

Follow the respective dataset and map-data licenses and attribution requirements when deploying or redistributing the project.

---

<p align="center">
  <b>🚚 RouteMind AI</b><br/>
  <i>Don't just plan the route. Adapt to reality.</i>
</p>
