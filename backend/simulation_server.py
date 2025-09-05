# backend/simulation_server.py
import collections
import collections.abc
import asyncio
import websockets
import json
import time
import math
import threading
from typing import List, Dict, Optional, Tuple

# --- Monkey patch for Python 3.10+ compatibility ---
if not hasattr(collections, 'MutableMapping'):
    collections.MutableMapping = collections.abc.MutableMapping

from dronekit import connect, VehicleMode, LocationGlobalRelative, Command
from pymavlink import mavutil

# --- Global state variables ---
vehicle = None
mission_task = None
current_mission = None
is_mission_active = False
telemetry_active = False

class MissionState:
    def __init__(self):
        self.waypoints: List[Dict] = []
        self.altitude: float = 100
        self.current_waypoint: int = 0
        self.mission_type: str = "survey"  # survey, waypoint, rtl
        self.flight_speed: float = 10
        self.photo_interval: float = 2.0  # seconds between photos
        self.photos_taken: int = 0
        self.coverage_area: float = 0
        self.flight_pattern: str = "grid"  # grid, perimeter, custom

async def connect_to_drone():
    """Connects to the SITL drone and returns the vehicle object."""
    global vehicle
    print("Attempting to connect to vehicle on: tcp:127.0.0.1:5760")
    try:
        # Use threading to avoid blocking the async loop
        loop = asyncio.get_event_loop()
        vehicle = await loop.run_in_executor(
            None, 
            lambda: connect('tcp:127.0.0.1:5760', wait_ready=True, timeout=60)
        )
        print("Vehicle connected successfully!")
        
        # Set up vehicle parameters for better simulation
        vehicle.parameters['WPNAV_SPEED'] = 1000  # cm/s
        vehicle.parameters['WPNAV_RADIUS'] = 200  # cm
        
        return vehicle
    except Exception as e:
        print(f"Error connecting to vehicle: {e}")
        return None

def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two GPS coordinates in meters."""
    R = 6371000  # Earth's radius in meters
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    a = (math.sin(delta_lat/2) * math.sin(delta_lat/2) + 
         math.cos(lat1_rad) * math.cos(lat2_rad) * 
         math.sin(delta_lon/2) * math.sin(delta_lon/2))
    
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    distance = R * c
    
    return distance

def generate_survey_pattern(waypoints: List[Dict], altitude: float, enhanced_3d: bool = False) -> List[Dict]:
    """Generate a lawn-mower survey pattern from polygon waypoints."""
    if len(waypoints) < 3:
        return waypoints
    
    # For now, create a simple grid pattern within the polygon bounds
    # In a real implementation, you'd use more sophisticated algorithms
    
    # Find bounding box
    lats = [wp['lat'] for wp in waypoints]
    lons = [wp['lng'] for wp in waypoints]
    
    min_lat, max_lat = min(lats), max(lats)
    min_lon, max_lon = min(lons), max(lons)
    
    # Create grid pattern
    survey_points = []
    grid_spacing = 0.0001  # Approximately 10 meters
    
    current_lat = min_lat
    row = 0
    
    while current_lat <= max_lat:
        if row % 2 == 0:  # Left to right
            current_lon = min_lon
            while current_lon <= max_lon:
                survey_points.append({
                    'lat': current_lat,
                    'lng': current_lon,
                    'altitude': altitude,
                    'action': 'photo'
                })
                current_lon += grid_spacing
        else:  # Right to left
            current_lon = max_lon
            while current_lon >= min_lon:
                survey_points.append({
                    'lat': current_lat,
                    'lng': current_lon,
                    'altitude': altitude,
                    'action': 'photo'
                })
                current_lon -= grid_spacing
        
        current_lat += grid_spacing
        row += 1
    
    # If enhanced 3D, add perpendicular passes
    if enhanced_3d:
        perpendicular_points = []
        current_lon = min_lon
        col = 0
        
        while current_lon <= max_lon:
            if col % 2 == 0:  # Bottom to top
                current_lat = min_lat
                while current_lat <= max_lat:
                    perpendicular_points.append({
                        'lat': current_lat,
                        'lng': current_lon,
                        'altitude': altitude + 10,  # Slightly higher
                        'action': 'photo'
                    })
                    current_lat += grid_spacing
            else:  # Top to bottom
                current_lat = max_lat
                while current_lat >= min_lat:
                    perpendicular_points.append({
                        'lat': current_lat,
                        'lng': current_lon,
                        'altitude': altitude + 10,
                        'action': 'photo'
                    })
                    current_lat -= grid_spacing
            
            current_lon += grid_spacing
            col += 1
        
        survey_points.extend(perpendicular_points)
    
    return survey_points

async def execute_mission_async(mission_data: Dict, websocket):
    """Execute the drone mission asynchronously."""
    global vehicle, is_mission_active, current_mission
    
    if not vehicle:
        await send_message(websocket, "flight_path", {
    "points": survey_points,
    "total_points": len(survey_points)
})
        return
    
    try:
        is_mission_active = True
        current_mission = MissionState()
        
        # Parse mission data
        waypoints = mission_data.get('waypoints', [])
        altitude = mission_data.get('altitude', 100) * 0.3048  # Convert feet to meters
        enhanced_3d = mission_data.get('enhanced3d', False)
        
        current_mission.waypoints = waypoints
        current_mission.altitude = altitude
        
        # Generate survey pattern
        survey_points = generate_survey_pattern(waypoints, altitude, enhanced_3d)
        
        await send_message(websocket, "mission_info", {
            "total_waypoints": len(survey_points),
            "estimated_time": len(survey_points) * 3,  # 3 seconds per point
            "coverage_pattern": "enhanced_3d" if enhanced_3d else "standard_grid"
        })
        
        print(f"Starting mission with {len(survey_points)} survey points")
        
        # Arm and takeoff
        await send_message(websocket, "status", "Pre-flight checks...")
        
        # Wait for vehicle to be armable
        timeout = 30
        start_time = time.time()
        while not vehicle.is_armable and time.time() - start_time < timeout:
            await asyncio.sleep(1)
        
        if not vehicle.is_armable:
            raise Exception("Vehicle not armable after timeout")
        
        await send_message(websocket, "status", "Arming vehicle...")
        vehicle.mode = VehicleMode("GUIDED")
        vehicle.armed = True
        
        # Wait for arming
        while not vehicle.armed and is_mission_active:
            await asyncio.sleep(0.5)
        
        if not is_mission_active:
            return
        
        await send_message(websocket, "status", f"Taking off to {altitude:.0f}m...")
        vehicle.simple_takeoff(altitude)
        
        # Wait for takeoff
        while vehicle.location.global_relative_frame.alt < altitude * 0.95 and is_mission_active:
            await asyncio.sleep(0.5)
        
        if not is_mission_active:
            await send_message(websocket, "status", "Mission cancelled during takeoff")
            vehicle.mode = VehicleMode("RTL")
            return
        
        await send_message(websocket, "status", "Takeoff complete, starting survey...")
        
        # Execute survey pattern
        for i, point in enumerate(survey_points):
            if not is_mission_active:
                break
            
            await send_message(websocket, "status", f"Flying to survey point {i+1}/{len(survey_points)}")
            await send_message(websocket, "waypoint_progress", {
                "current": i + 1,
                "total": len(survey_points),
                "percentage": ((i + 1) / len(survey_points)) * 100
            })
            
            # Navigate to point
            target_location = LocationGlobalRelative(
                point['lat'], 
                point['lng'], 
                point.get('altitude', altitude)
            )
            vehicle.simple_goto(target_location, groundspeed=current_mission.flight_speed)
            
            # Wait to reach waypoint
            while is_mission_active:
                current_location = vehicle.location.global_relative_frame
                distance = calculate_distance(
                    current_location.lat, current_location.lon,
                    point['lat'], point['lng']
                )
                
                if distance < 2:  # Within 2 meters
                    break
                
                await asyncio.sleep(0.2)
            
            if not is_mission_active:
                break
            
            # Perform action at waypoint
            if point.get('action') == 'photo':
                current_mission.photos_taken += 1
                await send_message(websocket, "photo_taken", {
                    "photo_number": current_mission.photos_taken,
                    "location": {
                        "lat": point['lat'],
                        "lng": point['lng'],
                        "altitude": point.get('altitude', altitude)
                    }
                })
                
                # Simulate camera capture delay
                await asyncio.sleep(0.5)
        
        if is_mission_active:
            await send_message(websocket, "mission_complete", {
                "photos_taken": current_mission.photos_taken,
                "waypoints_completed": len(survey_points)
            })
            await send_message(websocket, "status", "Mission complete - returning to launch")
        else:
            await send_message(websocket, "status", "Mission cancelled - returning to launch")
        
        # Return to launch
        vehicle.mode = VehicleMode("RTL")
        
        # Wait for landing
        while vehicle.armed and is_mission_active:
            await asyncio.sleep(1)
        
        await send_message(websocket, "simulation_end", "Landing complete")
        
    except Exception as e:
        print(f"Mission execution error: {e}")
        await send_message(websocket, "error", f"Mission error: {str(e)}")
        if vehicle:
            vehicle.mode = VehicleMode("RTL")
    
    finally:
        is_mission_active = False
        current_mission = None

async def stream_telemetry(websocket):
    """Stream real-time telemetry data."""
    global telemetry_active
    telemetry_active = True
    
    while telemetry_active:
        try:
            if vehicle and vehicle.armed:
                location = vehicle.location.global_relative_frame
                attitude = vehicle.attitude
                
                # Convert heading from radians to degrees
                heading = attitude.yaw * (180 / math.pi)
                if heading < 0:
                    heading += 360
                
                # Calculate ground speed
                velocity = vehicle.velocity
                ground_speed = math.sqrt(velocity[0]**2 + velocity[1]**2) if velocity[0] is not None else 0
                
                telemetry_data = {
                    "lat": location.lat,
                    "lng": location.lon,
                    "alt": location.alt,
                    "alt_feet": location.alt / 0.3048,
                    "heading": heading,
                    "ground_speed": ground_speed,
                    "battery": vehicle.battery.level if vehicle.battery.level else 100,
                    "mode": str(vehicle.mode.name),
                    "armed": vehicle.armed,
                    "gps_fix": vehicle.gps_0.fix_type if vehicle.gps_0 else 0
                }
                
                # Add mission progress if active
                if is_mission_active and current_mission:
                    telemetry_data["mission_status"] = {
                        "active": True,
                        "photos_taken": current_mission.photos_taken,
                        "current_waypoint": current_mission.current_waypoint
                    }
                
                await send_message(websocket, "telemetry", telemetry_data)
            
            await asyncio.sleep(0.1)  # 10 Hz telemetry rate
            
        except websockets.exceptions.ConnectionClosed:
            print("Telemetry stream stopped: Connection closed")
            break
        except Exception as e:
            print(f"Telemetry error: {e}")
            await asyncio.sleep(1)
    
    telemetry_active = False

async def send_message(websocket, message_type: str, payload):
    """Send a message to the websocket client."""
    try:
        message = {
            "type": message_type,
            "payload": payload,
            "timestamp": time.time()
        }
        await websocket.send(json.dumps(message))
    except Exception as e:
        print(f"Error sending message: {e}")

async def handle_client_messages(websocket):
    """Handle incoming messages from the client."""
    global is_mission_active, mission_task
    
    async for message in websocket:
        try:
            data = json.loads(message)
            command = data.get("command")
            
            print(f"Received command: {command}")
            
            if command == "start_mission":
                if is_mission_active:
                    await send_message(websocket, "error", "Mission already in progress")
                    continue
                
                mission_data = data.get("data", {})
                
                # Start mission in background
                mission_task = asyncio.create_task(
                    execute_mission_async(mission_data, websocket)
                )
                
            elif command == "stop_mission":
                if is_mission_active:
                    is_mission_active = False
                    await send_message(websocket, "status", "Stopping mission...")
                    
                    if vehicle:
                        vehicle.mode = VehicleMode("RTL")
                else:
                    await send_message(websocket, "warning", "No active mission to stop")
            
            elif command == "emergency_land":
                if vehicle and vehicle.armed:
                    vehicle.mode = VehicleMode("LAND")
                    await send_message(websocket, "status", "Emergency landing initiated")
            
            elif command == "get_status":
                status = {
                    "connected": vehicle is not None,
                    "armed": vehicle.armed if vehicle else False,
                    "mode": str(vehicle.mode.name) if vehicle else "Unknown",
                    "mission_active": is_mission_active
                }
                await send_message(websocket, "vehicle_status", status)
                
        except json.JSONDecodeError:
            await send_message(websocket, "error", "Invalid JSON message")
        except Exception as e:
            print(f"Error handling client message: {e}")
            await send_message(websocket, "error", f"Command processing error: {str(e)}")

async def handle_client_connection(websocket):
    """Handle new client connections."""
    client_address = f"{websocket.remote_address[0]}:{websocket.remote_address[1]}"
    print(f"Client connected from {client_address}")
    
    try:
        # Send initial connection status
        await send_message(websocket, "connected", {
            "vehicle_connected": vehicle is not None,
            "server_version": "2.0.0"
        })
        
        # Start telemetry stream
        telemetry_task = asyncio.create_task(stream_telemetry(websocket))
        
        # Handle incoming messages
        message_task = asyncio.create_task(handle_client_messages(websocket))
        
        # Wait for either task to complete
        done, pending = await asyncio.wait(
            [telemetry_task, message_task],
            return_when=asyncio.FIRST_COMPLETED
        )
        
        # Cancel remaining tasks
        for task in pending:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
    
    except websockets.exceptions.ConnectionClosed:
        print("Client disconnected normally")
    except Exception as e:
        print(f"Client connection error: {e}")
    finally:
        # Clean up on disconnect
        global telemetry_active, is_mission_active
        telemetry_active = False
        
        if is_mission_active:
            print("Client disconnected during mission - stopping mission")
            is_mission_active = False
            if vehicle:
                vehicle.mode = VehicleMode("RTL")
        
        print(f"Client {client_address} disconnected")

async def main():
    """Main server function."""
    print("Starting Enhanced Drone Simulation Server...")
    
    # Connect to drone
    vehicle = await connect_to_drone()
    if not vehicle:
        print("Failed to connect to vehicle. Exiting.")
        return
    
    print("Vehicle connected successfully!")
    print("Starting WebSocket server on ws://localhost:8765")
    
    # Start WebSocket server
    async with websockets.serve(handle_client_connection, "localhost", 8765):
        print("Simulation server ready for connections")
        print("Press Ctrl+C to stop the server")
        
        try:
            await asyncio.Future()  # Run forever
        except KeyboardInterrupt:
            print("\nShutting down server...")
            
            # Clean shutdown
            global is_mission_active
            if is_mission_active:
                is_mission_active = False
                if vehicle:
                    vehicle.mode = VehicleMode("RTL")
            
            if vehicle:
                vehicle.close()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nServer stopped by user")
    except Exception as e:
        print(f"Server error: {e}")