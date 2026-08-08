/**
 * Dashboard Routes
 */
const express = require('express');
const router = express.Router();
const proxy = require('../services/pythonProxy');
const OptimizationLog = require('../models/OptimizationLog');

// GET /api/dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const { data } = await proxy.getDashboard();

    // Augment with ML health
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

// POST /api/optimize
router.post('/optimize', async (req, res) => {
  const { route_id } = req.body;
  if (!route_id) return res.status(400).json({ error: 'route_id is required' });

  try {
    const { data } = await proxy.optimizeRoute(route_id);

    // Persist log to MongoDB (best-effort)
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

// POST /api/simulate-event (alias for replan)
router.post('/simulate-event', async (req, res) => {
  try {
    const { data } = await proxy.replan(req.body);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Event simulation failed', detail: err.message });
  }
});

// GET /api/comparison
router.get('/comparison', async (req, res) => {
  const { route_id } = req.query;
  if (!route_id) return res.status(400).json({ error: 'route_id is required' });
  try {
    const { data } = await proxy.getComparison(route_id);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Comparison failed', detail: err.message });
  }
});

// GET /api/analytics
router.get('/analytics', async (req, res) => {
  try {
    const logs = await OptimizationLog.find().sort({ timestamp: -1 }).limit(50);
    const total = await OptimizationLog.countDocuments();

    res.json({
      total_optimizations: total,
      recent_logs: logs,
    });
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

module.exports = router;
