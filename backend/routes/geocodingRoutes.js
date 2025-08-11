// backend/routes/geocodingRoutes.js
const express = require('express');
const router = express.Router();
const { geocodeAddress } = require('../controllers/geocodingController');
const authMiddleware = require('../middleware/authMiddleware');

// Protect the route so only logged-in users can use our API key
router.get('/', authMiddleware, geocodeAddress);

module.exports = router;