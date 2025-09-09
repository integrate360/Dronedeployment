// backend/server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { WebSocketServer } = require('ws');
const { spawn } = require('child_process');

// 1. Configure dotenv to load variables from .env file
require('dotenv').config();

const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projectRoutes');
const projectDetailRoutes = require('./routes/projectDetailRoutes');
const app = express();

// --- MODIFICATION: Create an HTTP server for Express and WebSocket server ---
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

let pythonProcess = null;

// --- NEW: Function to start and manage the Python simulation process ---
const startPythonSimulation = () => {
  // Ensure we don't start multiple processes
  if (pythonProcess) {
    console.log('[Node Backend] Python simulation is already running.');
    return;
  }

  console.log('[Node Backend] Starting python simulation script...');
  pythonProcess = spawn('python', ['-u', './simulation_server.py']);

  pythonProcess.stdout.on('data', (data) => {
    const message = data.toString();
    console.log(`[Python Sim]: ${message.trim()}`);
    // Broadcast message to all connected frontend clients
    wss.clients.forEach(client => {
      if (client.readyState === 1) { // WebSocket.OPEN = 1
        client.send(message);
      }
    });
  });

  pythonProcess.stderr.on('data', (data) => {
    console.error(`[Python Sim ERROR]: ${data.toString().trim()}`);
  });

  pythonProcess.on('close', (code) => {
    console.log(`[Node Backend] Python simulation process exited with code ${code}`);
    pythonProcess = null; // Allow restart
  });
};

// --- NEW: WebSocket server logic to relay messages ---
wss.on('connection', ws => {
  console.log('[Node Backend] Frontend client connected via WebSocket.');

  ws.on('message', message => {
    console.log(`[Frontend CMD]: ${message}`);
    // Forward command from frontend to the Python script's stdin
    if (pythonProcess && pythonProcess.stdin) {
      pythonProcess.stdin.write(message + '\n');
    }
  });

  ws.on('close', () => {
    console.log('[Node Backend] Frontend client disconnected.');
  });
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/project-details', projectDetailRoutes);
app.use('/api/geocode', require('./routes/geocodingRoutes'));

// MongoDB Connection
const mongoURI = process.env.MONGO_URI;
mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB successfully connected to Atlas!'))
.catch(err => console.error('MongoDB connection error:', err));

const PORT = process.env.PORT || 5000;

// --- MODIFICATION: Use the http server to listen ---
server.listen(PORT, () => {
  console.log(`[Node Backend] Server running on port ${PORT}`);
  // --- NEW: Start the python simulation ---
  startPythonSimulation();
});

// --- NEW: Graceful shutdown for the python process ---
const cleanup = () => {
  if (pythonProcess) {
    console.log('[Node Backend] Stopping python simulation...');
    pythonProcess.kill('SIGINT');
  }
  server.close(() => {
    console.log('[Node Backend] Server shut down.');
    process.exit(0);
  });
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);