const ProjectDetail = require('../models/ProjectDetail');
const Project = require('../models/Project'); // To check for project existence
const turf = require('@turf/turf');

// --- MODIFICATION: Replaced random polygon with a default square ---
/**
 * Creates a square GeoJSON polygon geometry around a center point.
 * @param {Array<number>} centerCoords - The center coordinates as [longitude, latitude].
 * @returns {object} A GeoJSON Polygon geometry object.
 */
const createDefaultSquare = (centerCoords) => {
  const center = turf.point(centerCoords);
  // Create a 200m x 200m bounding box (100m radius from center)
  const buffered = turf.buffer(center, 0.1, { units: 'kilometers' });
  const bbox = turf.bbox(buffered);
  const squarePolygon = turf.bboxPolygon(bbox);
  
  return squarePolygon.geometry; // Return just the Geometry object
};

// @desc    Get or create project details for a specific project
// @route   GET /api/project-details/:projectId
// @access  Private
exports.getOrCreateProjectDetails = async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await Project.findOne({ _id: projectId, user: req.user.id });
    if (!project) {
      return res.status(404).json({ msg: 'Project not found or user not authorized' });
    }

    let details = await ProjectDetail.findOne({ project: projectId });

    if (!details) {
      const flightPathCenter = [project.longitude, project.latitude];
      details = new ProjectDetail({
        project: projectId,
        user: req.user.id,
        // --- MODIFICATION: Call the new function to create a square ---
        flightPath: createDefaultSquare(flightPathCenter),
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

    let updateOperation = {};
    const otherUpdates = { ...updates };

    delete otherUpdates.flightPath;
    
    if (Object.keys(otherUpdates).length > 0) {
      updateOperation.$set = otherUpdates;
    }

    if (updates.flightPath === null) {
      updateOperation.$unset = { flightPath: "" };
    } else if (updates.flightPath) {
      if (!updateOperation.$set) updateOperation.$set = {};
      updateOperation.$set.flightPath = updates.flightPath;
    }
    
    const details = await ProjectDetail.findOne({ project: projectId, user: req.user.id });

    if (!details) {
      return res.status(404).json({ msg: 'Project details not found or user not authorized.' });
    }

    const updatedDetails = await ProjectDetail.findOneAndUpdate(
      { project: projectId },
      updateOperation,
      { new: true, runValidators: true }
    );

    res.status(200).json(updatedDetails);

  } catch (error) {
    console.error('Error in updateProjectDetails:', error.message);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ msg: `Validation Error: ${error.message}` });
    }
    res.status(500).json({ msg: 'Server Error' });
  }
};