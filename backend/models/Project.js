// backend/models/Project.js
const mongoose = require('mongoose');

const ProjectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide a project name'],
    trim: true,
  },
  thumbnail: {
    type: String,
    default: 'https://placehold.co/600x400/E2E8F0/A0AEC0?text=Project', // A default placeholder
  },
  // This creates a direct link to the User who owns this project
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // --- NEW FIELDS ---
  latitude: {
    type: Number,
    required: [true, 'A location latitude is required.'],
  },
  longitude: {
    type: Number,
    required: [true, 'A location longitude is required.'],
  }
}, {
  timestamps: true // Automatically adds createdAt and updatedAt fields
});

module.exports = mongoose.model('Project', ProjectSchema);