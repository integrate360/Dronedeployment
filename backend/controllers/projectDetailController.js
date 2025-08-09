const ProjectDetail = require('../models/ProjectDetail');
const Project = require('../models/Project'); // To check for project existence
const turf = require('@turf/turf');

// Helper to create a random polygon for new projects
const createRandomPolygon = () => {
  const center = [-74.0060, 40.7128]; // New York City center as an example
  const radius = 0.1; // in kilometers
  const options = {
    num_vertices: 5,
    max_radial_length: 0.05,
    bbox: [center[0] - radius, center[1] - radius, center[0] + radius, center[1] + radius],
  };
  // Turf.js randomPolygon returns a FeatureCollection
  const randomPolygonFeature = turf.randomPolygon(1, options).features[0];
  return randomPolygonFeature.geometry; // Return just the Geometry object
};

// @desc    Get or create project details for a specific project
// @route   GET /api/project-details/:projectId
// @access  Private
exports.getOrCreateProjectDetails = async (req, res) => {
  try {
    const { projectId } = req.params;

    // First, verify the project exists and belongs to the user
    const project = await Project.findOne({ _id: projectId, user: req.user.id });
    if (!project) {
      return res.status(404).json({ msg: 'Project not found or user not authorized' });
    }

    let details = await ProjectDetail.findOne({ project: projectId });

    if (!details) {
      // If no details exist, create them with a default random flight path
      details = new ProjectDetail({
        project: projectId,
        user: req.user.id,
        flightPath: createRandomPolygon(),
      });
      await details.save();
    }
    res.status(200).json(details);
  } catch (error) {
    console.error('Error in getOrCreateProjectDetails:', error);
    res.status(500).json({ msg: 'Server Error' });
  }
};


// @desc    Update project details
// @route   PUT /api/project-details/:projectId
// @access  Private
exports.updateProjectDetails = async (req, res) => {
  try {
    const { projectId } = req.params;
    const updates = req.body;

    // Find the details document linked to the project
    let details = await ProjectDetail.findOne({ project: projectId });

    if (!details) {
      return res.status(404).json({ msg: 'Project details not found.' });
    }

    // Ensure the user owns these details
    if (details.user.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'Not authorized' });
    }

    // Update the document
    const updatedDetails = await ProjectDetail.findOneAndUpdate(
      { project: projectId },
      { $set: updates },
      { new: true, runValidators: true }
    );

    res.status(200).json(updatedDetails);
  } catch (error) {
    console.error('Error in updateProjectDetails:', error);
    res.status(500).json({ msg: 'Server Error' });
  }
};
