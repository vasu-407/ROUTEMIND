/**
 * OptimizationLog Schema
 * Audit trail of every optimization run
 */
const mongoose = require('mongoose');

const OptimizationLogSchema = new mongoose.Schema({
  routeId: { type: String, required: true },
  solver: { type: String, enum: ['ortools', 'greedy', 'ml_augmented'], required: true },
  trigger: { type: String, enum: ['manual', 'event', 'scheduled'], default: 'manual' },
  eventType: String,
  metrics: {
    distanceKm: Number,
    travelTimeSec: Number,
    efficiencyScore: Number,
    executionTimeMs: Number,
  },
  explanation: mongoose.Schema.Types.Mixed,
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model('OptimizationLog', OptimizationLogSchema);
