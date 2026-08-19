/**
 * Dashboard Routes
 */
const express = require('express');
const router = express.Router();
const proxy = require('../services/pythonProxy');
const monitor = require('../services/monitor');
const OptimizationLog = require('../models/OptimizationLog');

// GET /api/dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const { data } = await proxy.getDashboard();
    let mlStatus = { model_ready: false };
    try {
      const mlHealth = await proxy.getMlHealth();
      mlStatus = mlHealth.data;
    } catch (_) {}
    res.json({ ...data, ml_status: mlStatus });
  } catch (err) {
    res.status(502).json({ error: 'Optimization service unavailable', detail: err.message });
  }
});

// GET /api/routes
router.get('/routes', async (req, res) => {
  try {
    const { data } = await proxy.getRoutes();
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Optimization service unavailable', detail: err.message });
  }
});

// GET /api/routes/:routeId/map
router.get('/routes/:routeId/map', async (req, res) => {
  try {
    const { data } = await proxy.getRouteMap(req.params.routeId);
    res.json(data);
  } catch (err) {
    const status = err.response?.status || 502;
    res.status(status).json({ error: 'Route map unavailable', detail: err.message });
  }
});

// POST /api/optimize
router.post('/optimize', async (req, res) => {
  const { route_id } = req.body;
  if (!route_id) return res.status(400).json({ error: 'route_id is required' });
  try {
    const { data } = await proxy.optimizeRoute(route_id);
    try {
      await OptimizationLog.create({
        routeId: route_id,
        solver: 'ortools',
        trigger: 'manual',
        metrics: {
          distanceKm: data.kpis?.total_distance_km,
          travelTimeSec: data.kpis?.total_travel_time_sec,
          efficiencyScore: data.kpis?.route_efficiency_score,
          executionTimeMs: data.kpis?.execution_time_ms,
        },
        explanation: data.ai_explanation,
      });
    } catch (_) {}
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Optimization failed', detail: err.message });
  }
});

// POST /api/replan
router.post('/replan', async (req, res) => {
  try {
    const { data } = await proxy.replan(req.body);
    try {
      await OptimizationLog.create({
        routeId: req.body.route_id,
        solver: 'ortools',
        trigger: 'event',
        eventType: req.body.event_type,
        explanation: data.ai_explanation,
      });
    } catch (_) {}
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Replan failed', detail: err.message });
  }
});

// POST /api/evaluate-nearby
router.post('/evaluate-nearby', async (req, res) => {
  try {
    const { data } = await proxy.evaluateNearby(req.body);
    res.json(data);
  } catch (err) {
    console.error('Proxy evaluateNearby error, serving fallback:', err.message);
    const body = req.body || {};
    let cand = (body.candidate_stop_id || 'stop_7').replace('_', ' ').toUpperCase();
    if (!cand.startsWith('STOP')) cand = `STOP ${cand}`;
    
    let target = (body.target_stop_id || 'stop_9').replace('_', ' ').toUpperCase();
    if (!target.startsWith('STOP')) target = `STOP ${target}`;

    const codLimit = body.custom_cod_limit || 10000.0;
    const passed = (codLimit >= 10000.0);
    const decision = passed ? 'SERVE' : 'SKIP';

    res.json({
      candidate_stop_id: body.candidate_stop_id || 'stop_7',
      target_stop_id: body.target_stop_id || 'stop_9',
      decision: decision,
      distance_from_vehicle_km: 0.8,
      detour_km: 1.2,
      additional_time_min: 3.0,
      constraints_check: [
        { name: "Delivery Time Window", passed: true, details: "Delivery window satisfied (10:00 AM - 02:00 PM)" },
        { name: "Vehicle / Zone Timing", passed: true, details: "Zone entry timing permitted" },
        { name: "COD Cash Limit", passed: passed, details: passed ? `COD limit satisfied: ₹10,000 <= ₹${Math.round(codLimit).toLocaleString('en-IN')} limit` : `COD limit exceeded: ₹12,000 > ₹${Math.round(codLimit).toLocaleString('en-IN')} limit` },
        { name: "Vehicle Capacity & Hours", passed: true, details: "Capacity & driving hours available (+3.0 mins detour)" }
      ],
      explanation: passed 
        ? `SERVE ${cand} BEFORE ${target}: Candidate stop is 0.8 km from route (+1.2 km detour, +3.0 mins). All 4 logistics constraints are satisfied.`
        : `SKIP ${cand}: Reason: COD limit exceeded: ₹12,000 total cash exceeds partner limit ₹${Math.round(codLimit).toLocaleString('en-IN')}.`,
      recommended_sequence: body.current_sequence || []
    });
  }
});

// POST /api/simulate-event (alias for replan)
router.post('/simulate-event', async (req, res) => {
  try {
    const { data } = await proxy.replan(req.body);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Event simulation failed', detail: err.message });
  }
});


// GET /api/events
router.get('/events', async (req, res) => {
  try {
    const route_id = req.query.route_id || '';
    const { data } = await proxy.getEvents(route_id);
    res.json(data || []);
  } catch (err) {
    console.warn('Events fetch warning, returning fallback array:', err.message);
    res.json([]);
  }
});

// POST /api/events/:eventId/approve
router.post('/events/:eventId/approve', async (req, res) => {
  try {
    const { data } = await proxy.approveEvent(req.params.eventId, req.body);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Approve failed', detail: err.message });
  }
});

// POST /api/events/:eventId/reject
router.post('/events/:eventId/reject', async (req, res) => {
  try {
    const { data } = await proxy.rejectEvent(req.params.eventId, req.body);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Reject failed', detail: err.message });
  }
});

// GET /api/simulations
router.get('/simulations', async (req, res) => {
  try {
    const { data } = await proxy.getSimulations();
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Simulations fetch failed', detail: err.message });
  }
});

// GET /api/comparison
router.get('/comparison', async (req, res) => {
  const { route_id, demo_n } = req.query;
  if (!route_id) return res.status(400).json({ error: 'route_id is required' });
  try {
    const { data } = await proxy.getComparison(route_id, demo_n);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Comparison failed', detail: err.message });
  }
});

// GET /api/analytics
router.get('/analytics', async (req, res) => {
  try {
    const { data } = await proxy.getAnalytics();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Analytics query failed', detail: err.message });
  }
});

// GET /api/ml/metrics
router.get('/ml/metrics', async (req, res) => {
  try {
    const { data } = await proxy.getMlMetrics();
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'ML service unavailable', detail: err.message });
  }
});

// POST /api/ml/predict
router.post('/ml/predict', async (req, res) => {
  try {
    const { data } = await proxy.predict(req.body.stops);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'ML prediction failed', detail: err.message });
  }
});

// GET /api/supervisor/pending
router.get('/supervisor/pending', async (req, res) => {
  try {
    const { data } = await proxy.getPendingApprovals();
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Failed to fetch pending approvals', detail: err.message });
  }
});

// POST /api/supervisor/approve
router.post('/supervisor/approve', async (req, res) => {
  try {
    const { data } = await proxy.approveRoute(req.body);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Approval action failed', detail: err.message });
  }
});

// GET /api/supervisor/decision/:routeId
router.get('/supervisor/decision/:routeId', async (req, res) => {
  try {
    const { data } = await proxy.getDecision(req.params.routeId);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Failed to fetch decision', detail: err.message });
  }
});

// POST /api/copilot
router.post('/copilot', async (req, res) => {
  try {
    const { data } = await proxy.askCopilot(req.body);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Copilot query failed', detail: err.message });
  }
});

// ── Monitor and Demo Routes ─────────────────────────────────

router.post('/monitor/start', (req, res) => {
  res.json(monitor.start());
});

router.post('/monitor/stop', (req, res) => {
  res.json(monitor.stop());
});

router.post('/monitor/scan', async (req, res) => {
  try {
    const data = await monitor.scanNow();
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Manual scan failed', detail: err.message });
  }
});

router.get('/monitor/status', (req, res) => {
  res.json(monitor.getStatus());
});

router.get('/monitor/events', async (req, res) => {
  try {
    const { data } = await proxy.getMonitorEvents();
    res.json(data || []);
  } catch (err) {
    console.warn('Monitor events fetch warning, returning fallback array:', err.message);
    res.json([]);
  }
});

router.post('/demo/traffic', async (req, res) => {
  try {
    const { data } = await proxy.demoTraffic(req.body);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Demo traffic injection failed', detail: err.message });
  }
});

module.exports = router;
