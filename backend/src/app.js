/**
 * RouteMind AI Logistics Control Tower — Node.js Backend
 * Express API gateway sitting between React frontend and Python microservices.
 * Port: 3000
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const apiRouter = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/routemind';

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Routes ──────────────────────────────────────────────────────────────────
app.use('/api', apiRouter);

// ── Health Check ────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'RouteMind Node.js Gateway',
    mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

// ── MongoDB Connection ──────────────────────────────────────────────────────
async function startServer() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log(`✅ MongoDB connected: ${MONGO_URI}`);
  } catch (err) {
    console.warn(`⚠️  MongoDB not available (${err.message}). Running without persistence.`);
  }

  app.listen(PORT, () => {
    console.log(`\n🚀 RouteMind API Gateway running on http://localhost:${PORT}`);
    console.log(`   → Proxying Optimization API: ${process.env.PYTHON_API_URL || 'http://localhost:8000'}`);
    console.log(`   → Proxying ML API          : ${process.env.ML_API_URL    || 'http://localhost:8001'}\n`);
  });
}

startServer();
