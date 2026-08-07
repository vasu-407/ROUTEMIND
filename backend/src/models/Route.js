/**
 * Route Schema
 * Stores route optimization logs in MongoDB
 */
const mongoose = require('mongoose');

const RouteSchema = new mongoose.Schema({
  routeId: { type: String, required: true, index: true },
  stationCode: String,
  numStops: Number,
  status: { type: String, enum: ['pending', 'optimized', 'replanned', 'completed'], default: 'pending' },
  optimizationResult: {
    sequence: [String],
    totalDistanceKm: Number,
    totalTravelTimeSec: Number,
    routeEfficiencyScore: Number,
    capacityUtilization: Number,
    executionTimeMs: Number,
    fuelEstimateInr: Number,
  },
  greedyResult: {
    sequence: [String],
    totalDistanceKm: Number,
    totalTravelTimeSec: Number,
    executionTimeMs: Number,
  },
  constraintViolations: [String],
  aiExplanation: mongoose.Schema.Types.Mixed,
  mlPredictionsUsed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

RouteSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Route', RouteSchema);
