// backend/models/ProjectDetail.js
const mongoose = require('mongoose');

const ProjectDetailSchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    unique: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  flightAltitude: {
    type: Number,
    default: 200,
  },
  enhanced3d: {
    type: Boolean,
    default: false,
  },
  liveMapHd: {
    type: Boolean,
    default: false,
  },
  rtkCoverage: {
    type: Boolean,
    default: false,
  },
  flightPath: {
    type: {
      type: String,
      enum: ['Polygon'],
    },
    coordinates: {
      type: [[[Number]]],
    },
  },
  // --- MODIFICATION: Add field to store grid angle ---
  flightPathAngle: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('ProjectDetail', ProjectDetailSchema);