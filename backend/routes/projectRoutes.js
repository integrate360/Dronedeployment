// backend/routes/project.js
const express = require('express');
const router = express.Router();
const { 
  getProjects, 
  createProject, 
  updateProject, 
  deleteProject 
} = require('../controllers/projectController');
const authMiddleware = require('../middleware/authMiddleware');

// All these routes are protected and require a valid token
router.use(authMiddleware);

router.route('/')
  .get(getProjects)
  .post(createProject);

router.route('/:id')
  .put(updateProject)
  .delete(deleteProject);

module.exports = router;