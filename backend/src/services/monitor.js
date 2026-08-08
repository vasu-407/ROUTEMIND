const proxy = require('./pythonProxy');

let monitorInterval = null;
let isMonitoring = false;

const INTERVAL_MS = process.env.MONITOR_INTERVAL_SECONDS 
  ? parseInt(process.env.MONITOR_INTERVAL_SECONDS) * 1000 
  : 10000;

async function scanRoutes() {
  if (!isMonitoring) return;
  try {
    console.log('[Monitor] Scanning active routes for traffic events...');
    const { data } = await proxy.monitorScan();
    if (data.detected_count > 0) {
      console.log(`[Monitor] 🚨 Detected ${data.detected_count} traffic events on routes:`, data.routes_affected);
    }
  } catch (err) {
    console.error('[Monitor] Error during scan:', err.message);
  }
}

module.exports = {
  start: () => {
    if (isMonitoring) return { status: 'already_running' };
    isMonitoring = true;
    monitorInterval = setInterval(scanRoutes, INTERVAL_MS);
    console.log('[Monitor] Started route monitoring.');
    return { status: 'started' };
  },
  stop: () => {
    if (!isMonitoring) return { status: 'already_stopped' };
    isMonitoring = false;
    clearInterval(monitorInterval);
    monitorInterval = null;
    console.log('[Monitor] Stopped route monitoring.');
    return { status: 'stopped' };
  },
  scanNow: async () => {
    try {
      const { data } = await proxy.monitorScan();
      return data;
    } catch (err) {
      throw new Error(`Manual scan failed: ${err.message}`);
    }
  },
  getStatus: () => ({ isMonitoring })
};
