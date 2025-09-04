// backend/routes/droneKitRoutes.js
const express = require('express');
const router = express.Router();
const { runMission } = require('../controllers/droneKitController');
const authMiddleware = require('../middleware/authMiddleware');

// All routes in this file are protected by the authentication middleware
router.use(authMiddleware);

// Defines the route: POST /api/drone/:projectId/fly
router.route('/:projectId/fly').post(runMission);

module.exports = router;