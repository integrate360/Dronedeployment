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

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));


// Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/project-details', projectDetailRoutes);
app.use('/api/geocode', require('./routes/geocodingRoutes'));


// 2. Use the MONGO_URI from process.env
const mongoURI = process.env.MONGO_URI;

// MongoDB Connection
mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB successfully connected to Atlas!'))
.catch(err => console.error('MongoDB connection error:', err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));