// backend/server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// 1. Configure dotenv to load variables from .env file
require('dotenv').config();

const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projectRoutes');
const projectDetailRoutes = require('./routes/projectDetailRoutes');
const app = express();

// --- REMOVED: All pythonProcess and startPythonServer logic ---
// The new Python script runs its own WebSocket server independently.

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));


// Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/project-details', projectDetailRoutes);
app.use('/api/geocode', require('./routes/geocodingRoutes'));


// MongoDB Connection
const mongoURI = process.env.MONGO_URI;
mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB successfully connected to Atlas!'))
.catch(err => console.error('MongoDB connection error:', err));

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`[Node Backend] Server running on port ${PORT}`);
  console.log("Please run the 'simulation_server.py' script in a separate terminal.");
});

// --- REMOVED: Graceful shutdown logic for pythonProcess ---