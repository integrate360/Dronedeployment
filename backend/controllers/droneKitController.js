// backend/controllers/droneKitController.js
const { spawn } = require('child_process');
const fs = require('fs'); // Import the File System module
const path = require('path');
const Project = require('../models/Project');
const ProjectDetail = require('../models/ProjectDetail');

let isSimulationRunning = false;

const spawnProcess = (command, args, options) => {
  return new Promise((resolve, reject) => {
    const process = spawn(command, args, options);
    process.on('error', (err) => reject(err));
    resolve(process);
  });
};

exports.runMission = async (req, res) => {
  if (isSimulationRunning) {
    return res.status(409).json({ msg: 'A simulation is already in progress. Please wait.' });
  }

  const broadcast = req.app.get('broadcast');
  console.log('\n--- New Mission Request Received ---');

  try {
    const { projectId } = req.params;
    // --- Data Fetching (remains the same) ---
    const project = await Project.findOne({ _id: projectId, user: req.user.id });
    if (!project) return res.status(404).json({ msg: 'Project not found' });
    const details = await ProjectDetail.findOne({ project: projectId });
    if (!details || !details.flightPath || !details.flightPath.coordinates[0] || details.flightPath.coordinates[0].length < 4) {
      return res.status(400).json({ msg: 'Project has no valid flight path.' });
    }

    // --- STEP 1: VERIFY SCRIPT PATH (with extensive logging) ---
    console.log(`[DEBUG] Controller __dirname:`, __dirname);
    const scriptDirectory = path.join(__dirname, '..', 'scripts');
    const scriptPath = path.join(scriptDirectory, 'drone_mission.py');
    console.log(`[DEBUG] Expecting script at path:`, scriptPath);

    if (!fs.existsSync(scriptPath)) {
      const errorMessage = `FATAL ERROR: Script file not found at the expected path. Please check your project's file structure.`;
      console.error(`[DEBUG] fs.existsSync check FAILED for path: ${scriptPath}`);
      throw new Error(errorMessage);
    }
    console.log(`[DEBUG] fs.existsSync check PASSED. Script file found.`);
    
    // --- If validation passes, we can proceed ---
    res.status(202).json({ msg: 'Mission command accepted. Starting simulation...' });
    isSimulationRunning = true;

    const missionData = {
      altitude: details.flightAltitude,
      waypoints: details.flightPath.coordinates[0].slice(0, -1).map(c => ({ lat: c[1], lng: c[0] })),
      home: { lat: project.latitude, lng: project.longitude }
    };

    // --- STEP 2: SPAWN PROCESS (with extensive logging) ---
    const scriptFilename = path.basename(scriptPath);
    const scriptArgs = [scriptFilename, JSON.stringify(missionData)];
    const spawnOptions = { cwd: scriptDirectory }; // Set the working directory to the script's folder
    
    console.log(`[DEBUG] Spawning process with options:`);
    console.log(`[DEBUG]   - Command: 'python3' (will fall back to 'python')`);
    console.log(`[DEBUG]   - Arguments: ${JSON.stringify(scriptArgs)}`);
    console.log(`[DEBUG]   - Working Directory (cwd): ${spawnOptions.cwd}`);

    let pythonProcess;
    try {
      pythonProcess = await spawnProcess('python3', scriptArgs, spawnOptions);
    } catch (err) {
      if (err.code === 'ENOENT') {
        console.log("[INFO] `python3` command not found. Falling back to `python`.");
        try {
          pythonProcess = await spawnProcess('python', scriptArgs, spawnOptions);
        } catch (err2) {
          throw new Error("Python interpreter not found. Ensure 'python' or 'python3' is in your system's PATH.");
        }
      } else {
        throw err;
      }
    }
    
    console.log('[INFO] Python process spawned successfully.');

    // --- Attach listeners (remains the same) ---
    pythonProcess.stdout.on('data', (data) => {
      data.toString().split('\n').forEach(line => {
        if (line) {
          try {
            broadcast({ type: 'telemetry', payload: JSON.parse(line) });
          } catch (e) { console.log('[DroneKit Script]:', line); }
        }
      });
    });

    pythonProcess.stderr.on('data', (data) => {
      console.error(`[DroneKit Script Error]: ${data.toString()}`);
      broadcast({ type: 'error', payload: "Simulation script failed. Check server logs." });
    });

    pythonProcess.on('close', (code) => {
      console.log(`[DroneKit Script] exited with code ${code}`);
      if (code !== 0) {
        broadcast({ type: 'error', payload: `Simulation ended unexpectedly (code: ${code}).` });
      } else {
        broadcast({ type: 'simulation_end', payload: `Simulation finished successfully.` });
      }
      isSimulationRunning = false;
    });

  } catch (error) {
    isSimulationRunning = false;
    console.error('[FATAL] Error in runMission controller:', error.message);
    broadcast({ type: 'error', payload: error.message });
    // Don't res.status here if headers were already sent
  }
};