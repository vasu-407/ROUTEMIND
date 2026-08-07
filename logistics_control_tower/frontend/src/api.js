import axios from 'axios';

// Node.js Express Gateway (which proxies to Python services)
const api = axios.create({
  baseURL: 'http://localhost:3000/api',
});

export const getDashboardData = () => api.get('/dashboard');
export const getRoutes = () => api.get('/routes');
export const optimizeRoute = (routeId) => api.post('/optimize', { route_id: routeId });
export const replanEvent = (payload) => api.post('/replan', payload);
export const compareSolvers = (routeId) => api.get(`/comparison?route_id=${routeId}`);
export const getAnalytics = () => api.get('/analytics');
export const getMlMetrics = () => api.get('/ml/metrics');

export default api;
