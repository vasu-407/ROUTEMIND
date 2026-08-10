import axios from 'axios';

// Node.js Express Gateway (which proxies to Python services)
const api = axios.create({
  baseURL: 'http://localhost:3000/api',
});

export const getDashboardData = () => api.get('/dashboard');
export const getRoutes = () => api.get('/routes');
export const getRouteMap = (routeId) => api.get(`/routes/${encodeURIComponent(routeId)}/map`);
export const optimizeRoute = (routeId) => api.post('/optimize', { route_id: routeId });
export const replanEvent = (payload) => api.post('/replan', payload);
export const compareSolvers = (routeId) => api.get(`/comparison?route_id=${routeId}`);
export const getAnalytics = () => api.get('/analytics');
export const getSimulations = () => api.get('/events');
export const getMlMetrics = () => api.get('/ml/metrics');
export const getPendingApprovals = () => api.get('/supervisor/pending');
export const approveRoute = (payload) => api.post('/supervisor/approve', payload);
export const getSupervisorDecision = (routeId) => api.get(`/supervisor/decision/${encodeURIComponent(routeId)}`);

// New Event Lifecycle API
export const getEvents = (routeId) => api.get(routeId ? `/events?route_id=${encodeURIComponent(routeId)}` : '/events');
export const approveEvent = (eventId, payload) => api.post(`/events/${encodeURIComponent(eventId)}/approve`, payload);
export const rejectEvent = (eventId, payload) => api.post(`/events/${encodeURIComponent(eventId)}/reject`, payload);
export const askCopilot = (payload) => api.post('/copilot', payload);

// ── Monitor and Demo APIs ──────────────────────────────────
export const startMonitor = () => api.post('/monitor/start');
export const stopMonitor = () => api.post('/monitor/stop');
export const scanMonitor = () => api.post('/monitor/scan');
export const getMonitorStatus = () => api.get('/monitor/status');
export const getMonitorEvents = () => api.get('/monitor/events');
export const simulateTrafficDemo = (payload) => api.post('/demo/traffic', payload);

export default api;
