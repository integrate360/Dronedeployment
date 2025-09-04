# backend/simulation_server.py
import patch_dronekit

import asyncio
import websockets
import json
import time
import math
import subprocess
import os
import signal
import sys
from dronekit import connect, VehicleMode, Command

# --- Global State ---
SIMULATION_STATE = {
    "sitl_process": None,
    "vehicle": None,
    "mission_task": None,
    "is_running": False
}

def start_sitl(home_coords):
    if SIMULATION_STATE["sitl_process"]:
        print("[SIM] Terminating existing SITL process...")
        os.kill(SIMULATION_STATE["sitl_process"].pid, signal.SIGTERM)
        SIMULATION_STATE["sitl_process"].wait()

    print("[SIM] Starting new SITL process...")
    # This is a robust way to find the python executable's directory
    python_dir = os.path.dirname(sys.executable)
    sitl_executable = os.path.join(python_dir, 'dronekit-sitl')
    
    if os.name == 'nt': # If on Windows, it has a .exe extension
        sitl_executable += '.exe'
        
    if not os.path.exists(sitl_executable):
         raise FileNotFoundError(f"Could not find dronekit-sitl executable at '{sitl_executable}'. Please run 'pip install dronekit-sitl'.")

    home_str = f"{home_coords['lat']},{home_coords['lng']},0,180"
    cmd = [sitl_executable, 'copter', '--home', home_str]
    
    sitl_process = subprocess.Popen(cmd)
    SIMULATION_STATE["sitl_process"] = sitl_process
    
    time.sleep(5) # Give SITL time to start
    return 'udp:127.0.0.1:14550'

async def run_drone_mission(websocket, mission_data):
    SIMULATION_STATE["is_running"] = True
    try:
        connection_string = start_sitl(mission_data['home'])
        await websocket.send(json.dumps({"type": "status", "payload": f"Connecting to vehicle..."}))
        
        vehicle = connect(connection_string, wait_ready=True, timeout=60)
        SIMULATION_STATE["vehicle"] = vehicle
        await websocket.send(json.dumps({"type": "status", "payload": "Vehicle connected!"}))

        cmds = vehicle.commands
        cmds.clear()
        takeoff_alt_meters = float(mission_data['altitude']) * 0.3048
        cmds.add(Command(0, 0, 0, 3, 22, 0, 0, 0, 0, 0, 0, 0, 0, takeoff_alt_meters))
        for point in mission_data['waypoints']:
            cmds.add(Command(0, 0, 0, 3, 16, 0, 0, 0, 0, 0, 0, point['lat'], point['lng'], takeoff_alt_meters))
        cmds.add(Command(0, 0, 0, 3, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0))
        cmds.upload()
        
        vehicle.mode = VehicleMode("GUIDED")
        vehicle.armed = True
        while not vehicle.armed:
            await asyncio.sleep(1)
        
        vehicle.mode = VehicleMode("AUTO")
        await websocket.send(json.dumps({"type": "status", "payload": "Vehicle Armed! Mission Started."}))

        while SIMULATION_STATE["is_running"]:
            loc = vehicle.location.global_relative_frame
            heading = (vehicle.attitude.yaw * 180 / math.pi + 360) % 360
            telemetry = {"lat": loc.lat, "lng": loc.lon, "alt": loc.alt, "heading": heading}
            await websocket.send(json.dumps({"type": "telemetry", "payload": telemetry}))
            if vehicle.commands.next >= vehicle.commands.count and loc.alt < 1:
                break
            await asyncio.sleep(0.1)
    except Exception as e:
        await websocket.send(json.dumps({"type": "error", "payload": f"Simulation failed: {str(e)}"}))
    finally:
        print("[SIM] Cleaning up...")
        if SIMULATION_STATE["vehicle"]:
            SIMULATION_STATE["vehicle"].close()
        if SIMULATION_STATE["sitl_process"]:
            os.kill(SIMULATION_STATE["sitl_process"].pid, signal.SIGTERM)
        SIMULATION_STATE.update({"vehicle": None, "sitl_process": None, "is_running": False})
        await websocket.send(json.dumps({"type": "simulation_end", "payload": "Simulation finished."}))

async def stop_current_mission():
    if SIMULATION_STATE["mission_task"] and not SIMULATION_STATE["mission_task"].done():
        SIMULATION_STATE["is_running"] = False
        SIMULATION_STATE["mission_task"].cancel()
        try: await SIMULATION_STATE["mission_task"]
        except asyncio.CancelledError: print("[SIM] Mission cancelled.")
    else:
        if SIMULATION_STATE["sitl_process"]:
            os.kill(SIMULATION_STATE["sitl_process"].pid, signal.SIGTERM)
            SIMULATION_STATE["sitl_process"] = None

async def handler(websocket):  # REMOVED 'path' parameter here
    print(f"[SERVER] Client connected.")
    try:
        async for message in websocket:
            data = json.loads(message)
            if data.get("command") == "start_mission":
                await stop_current_mission()
                SIMULATION_STATE["mission_task"] = asyncio.create_task(run_drone_mission(websocket, data.get("data")))
            elif data.get("command") == "stop_mission":
                await stop_current_mission()
    except websockets.exceptions.ConnectionClosed:
        print(f"[SERVER] Client disconnected.")
    finally:
        await stop_current_mission()

async def main():
    port = 5001
    async with websockets.serve(handler, "localhost", port):
        print(f"[SERVER] Python WebSocket Simulation Server started on ws://localhost:{port}")
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())