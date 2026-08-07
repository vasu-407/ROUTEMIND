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
  optimizeRoute: (routeId) => pythonClient.post(`/optimize?route_id=${routeId}`),
  replan: (payload) => pythonClient.post('/replan', payload),
  getComparison: (routeId) => pythonClient.get(`/comparison?route_id=${routeId}`),

  // ── ML Service ────────────────────────────────────────────────
  predict: (stops) => mlClient.post('/predict', { stops }),
  getMlMetrics: () => mlClient.get('/metrics'),
  getMlHealth: () => mlClient.get('/health'),
};
