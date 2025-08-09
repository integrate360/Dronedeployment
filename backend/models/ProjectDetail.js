// backend/models/ProjectDetail.js
const mongoose = require('mongoose');

const ProjectDetailSchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    unique: true, // Each project has only one detail document
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
  // Using GeoJSON format for the flight path polygon
  flightPath: {
    type: {
      type: String,
      enum: ['Polygon'],
      required: true,
    },
    coordinates: {
      type: [[[Number]]], // Array of linear rings (arrays of points)
      required: true,
    },
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('ProjectDetail', ProjectDetailSchema);