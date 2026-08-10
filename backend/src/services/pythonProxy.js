/**
 * Python Services Proxy
 * Axios clients for communicating with the Python optimization and ML microservices.
 */
const axios = require('axios');

const PYTHON_API = process.env.PYTHON_API_URL || 'http://127.0.0.1:8000';
const ML_API = process.env.ML_API_URL || 'http://127.0.0.1:8001';

const pythonClient = axios.create({
  baseURL: PYTHON_API,
  timeout: 120000,  // 120s — first call loads the full dataset
});

const mlClient = axios.create({
  baseURL: ML_API,
  timeout: 30000,
});

module.exports = {
  // ── Optimization Service ─────────────────────────────────────
  getDashboard: () => pythonClient.get('/dashboard'),
  getRoutes: () => pythonClient.get('/routes'),
  getRouteMap: (routeId) => pythonClient.get(`/routes/${encodeURIComponent(routeId)}/map`),
  optimizeRoute: (routeId) => pythonClient.post(`/optimize?route_id=${routeId}`),
  replan: (payload) => pythonClient.post('/replan', payload),
  getComparison: (routeId, demoN) => {
    let url = `/comparison?route_id=${routeId}`;
    if (demoN) url += `&demo_n=${demoN}`;
    return pythonClient.get(url);
  },
  getSimulations: () => pythonClient.get('/simulations'),
  getAnalytics: () => pythonClient.get('/analytics'),
  getEvents: (routeId) => pythonClient.get(routeId ? `/events?route_id=${encodeURIComponent(routeId)}` : '/events'),
  approveEvent: (eventId, payload) => pythonClient.post(`/events/${encodeURIComponent(eventId)}/approve`, payload),
  rejectEvent: (eventId, payload) => pythonClient.post(`/events/${encodeURIComponent(eventId)}/reject`, payload),
  getPendingApprovals: () => pythonClient.get('/supervisor/pending'),
  approveRoute: (payload) => pythonClient.post('/supervisor/approve', payload),
  getDecision: (routeId) => pythonClient.get(`/supervisor/decision/${encodeURIComponent(routeId)}`),
  askCopilot: (payload) => pythonClient.post('/copilot', payload),
  
  // ── Monitor Service ──────────────────────────────────────────
  monitorScan: () => pythonClient.post('/monitor/scan'),
  getMonitorEvents: () => pythonClient.get('/monitor/events'),
  demoTraffic: (payload) => pythonClient.post('/demo/traffic', payload),

  // ── ML Service ────────────────────────────────────────────────
  predict: (stops) => mlClient.post('/predict', { stops }),
  getMlMetrics: () => mlClient.get('/metrics'),
  getMlHealth: () => mlClient.get('/health'),
};
