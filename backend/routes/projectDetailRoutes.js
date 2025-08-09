// backend/routes/projectDetailRoutes.js
const express = require('express');
const router = express.Router();
const {
  getOrCreateProjectDetails,
  updateProjectDetails,
} = require('../controllers/projectDetailController');
const authMiddleware = require('../middleware/authMiddleware');

// All these routes are protected
router.use(authMiddleware);

router.route('/:projectId')
  .get(getOrCreateProjectDetails)
  .put(updateProjectDetails);

module.exports = router;