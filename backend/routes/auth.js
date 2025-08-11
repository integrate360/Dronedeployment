const express = require('express');
const router = express.Router();
const { signup, login } = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware'); // Import middleware

// Public routes
router.post('/signup', signup);
router.post('/login', login);

// Protected route example
router.get('/me', authMiddleware, (req, res) => {
  // Because of the middleware, req.user is now available
  res.status(200).json(req.user);
});

module.exports = router;