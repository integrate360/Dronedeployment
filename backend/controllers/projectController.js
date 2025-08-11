// backend/controllers/projectController.js
const Project = require('../models/Project');
const ProjectDetail = require('../models/ProjectDetail'); // Import ProjectDetail for cascading delete

// @desc    Get all projects for a logged-in user
// @route   GET /api/projects
// @access  Private
exports.getProjects = async (req, res) => {
  try {
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
  // --- UPDATED ---
  const { name, latitude, longitude } = req.body;

  if (!name || latitude === undefined || longitude === undefined) {
    return res.status(400).json({ msg: 'Project name and a selected location are required' });
  }

  try {
    const newProject = new Project({
      name,
      latitude,
      longitude,
      user: req.user.id,
      // thumbnail will use default
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

    if (project.user.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'Not authorized' });
    }

    // For this implementation, we prevent changing the location after creation.
    const { latitude, longitude, ...allowedUpdates } = req.body;

    project = await Project.findByIdAndUpdate(req.params.id, allowedUpdates, {
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

    if (project.user.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'Not authorized' });
    }

    // --- ADDED CASCADING DELETE ---
    // Also delete associated project details to avoid orphaned documents
    await ProjectDetail.findOneAndDelete({ project: req.params.id });
    await Project.findByIdAndDelete(req.params.id);

    res.status(200).json({ msg: 'Project removed' });
  } catch (error) {
    res.status(500).json({ msg: 'Server error' });
  }
};