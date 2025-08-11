// backend/controllers/projectController.js
const Project = require('../models/Project');

// @desc    Get all projects for a logged-in user
// @route   GET /api/projects
// @access  Private
exports.getProjects = async (req, res) => {
  try {
    // req.user.id comes from the authMiddleware
    const projects = await Project.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.status(200).json(projects);
  } catch (error) {
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Create a new project
// @route   POST /api/projects
// @access  Private
exports.createProject = async (req, res) => {
  const { name, thumbnail } = req.body;

  if (!name) {
    return res.status(400).json({ msg: 'Project name is required' });
  }

  try {
    const newProject = new Project({
      name,
      thumbnail, // Will use default if not provided
      user: req.user.id,
    });

    const project = await newProject.save();
    res.status(201).json(project);
  } catch (error) {
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Update a project
// @route   PUT /api/projects/:id
// @access  Private
exports.updateProject = async (req, res) => {
  try {
    let project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ msg: 'Project not found' });
    }

    // Ensure user owns the project
    if (project.user.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'Not authorized' });
    }

    project = await Project.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.status(200).json(project);
  } catch (error) {
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Delete a project
// @route   DELETE /api/projects/:id
// @access  Private
exports.deleteProject = async (req, res) => {
  try {
    let project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ msg: 'Project not found' });
    }

    // Ensure user owns the project
    if (project.user.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'Not authorized' });
    }

    await Project.findByIdAndDelete(req.params.id);

    res.status(200).json({ msg: 'Project removed' });
  } catch (error) {
    res.status(500).json({ msg: 'Server error' });
  }
};