# backend/simulation_server.py
import collections
import collections.abc
import sys
import json
import time
import math
import threading
import os
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
sitl_process = None
# --- NEW: Thread lock for safe message sending ---
print_lock = threading.Lock()

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
        self.start_time: float = 0
        self.distance_flown: float = 0
        self.area_covered: float = 0

# --- NEW: Start SITL instance ---
def start_sitl():
    """Start the SITL simulator"""
    global sitl_process
    try:
        from dronekit_sitl import SITL
        send_message("status", "Starting SITL simulator...")
        
        # Start SITL on TCP port 5760
        sitl = SITL()
        sitl.download('copter', '3.3', verbose=True)
        sitl_args = ['--model', 'quad', '--home=-35.363261,149.165230,584,353']
        sitl.launch(sitl_args, await_ready=True, restart=True)
        
        # Connect to the simulator
        send_message("status", "SITL simulator started successfully")
        return sitl
    except Exception as e:
        send_message("error", f"Failed to start SITL: {str(e)}")
        return None

# --- NEW: Re-written send_message function for stdout ---
def send_message(message_type: str, payload):
    """Formats a message and prints it to stdout for the Node.js parent."""
    try:
        message = {
            "type": message_type,
            "payload": payload,
            "timestamp": time.time()
        }
        with print_lock:
            # Use print with flush=True to ensure Node.js receives it immediately
            print(json.dumps(message), flush=True)
    except Exception as e:
        # It's crucial to see errors if they happen here
        error_message = {"type": "error", "payload": f"Error in send_message: {e}"}
        with print_lock:
            print(json.dumps(error_message), flush=True)

def connect_to_drone():
    """Connects to the SITL drone and returns the vehicle object."""
    global vehicle
    send_message("status", "Attempting to connect to vehicle...")
    try:
        # Connect to the SITL instance
        vehicle = connect('tcp:127.0.0.1:5760', wait_ready=True, timeout=60)
        vehicle.parameters['WPNAV_SPEED'] = 1000  # cm/s
        vehicle.parameters['WPNAV_RADIUS'] = 200  # cm
        send_message("status", "Vehicle connected successfully!")
        return vehicle
    except Exception as e:
        send_message("error", f"Error connecting to vehicle: {e}")
        return None

def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two GPS coordinates in meters."""
    R = 6371000
    lat1_rad, lat2_rad = math.radians(lat1), math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    a = (math.sin(delta_lat/2)**2 +
         math.cos(lat1_rad) * math.cos(lat2_rad) *
         math.sin(delta_lon/2)**2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c

def generate_survey_pattern(waypoints: List[Dict], altitude: float, enhanced_3d: bool = False) -> List[Dict]:
    """Generate a lawn-mower survey pattern from polygon waypoints."""
    if len(waypoints) < 3: 
        send_message("error", "Need at least 3 waypoints to generate survey pattern")
        return waypoints
    
    # Convert to Turf.js compatible format [lng, lat]
    polygon_coords = [[wp['lng'], wp['lat']] for wp in waypoints]
    polygon_coords.append(polygon_coords[0])  # Close the polygon
    
    try:
        import turf
        # Create a polygon from the waypoints
        polygon = turf.polygon([polygon_coords])
        
        # Calculate bounding box
        bbox = turf.bbox(polygon)
        min_lng, min_lat, max_lng, max_lat = bbox
        
        survey_points = []
        grid_spacing = 0.0001  # Approximately 10 meters
        current_lat, row = min_lat, 0
        
        while current_lat <= max_lat:
            if row % 2 == 0:
                current_lon = min_lng
                while current_lon <= max_lng:
                    point = turf.point([current_lon, current_lat])
                    if turf.boolean_point_in_polygon(point, polygon):
                        survey_points.append({'lat': current_lat, 'lng': current_lon, 'altitude': altitude, 'action': 'photo'})
                    current_lon += grid_spacing
            else:
                current_lon = max_lng
                while current_lon >= min_lng:
                    point = turf.point([current_lon, current_lat])
                    if turf.boolean_point_in_polygon(point, polygon):
                        survey_points.append({'lat': current_lat, 'lng': current_lon, 'altitude': altitude, 'action': 'photo'})
                    current_lon -= grid_spacing
            current_lat += grid_spacing
            row += 1
            
        if enhanced_3d:
            # Add perpendicular grid for enhanced 3D
            current_lon, col = min_lon, 0
            while current_lon <= max_lon:
                if col % 2 == 0:
                    current_lat = min_lat
                    while current_lat <= max_lat:
                        point = turf.point([current_lon, current_lat])
                        if turf.boolean_point_in_polygon(point, polygon):
                            survey_points.append({'lat': current_lat, 'lng': current_lon, 'altitude': altitude + 10, 'action': 'photo'})
                        current_lat += grid_spacing
                else:
                    current_lat = max_lat
                    while current_lat >= min_lat:
                        point = turf.point([current_lon, current_lat])
                        if turf.boolean_point_in_polygon(point, polygon):
                            survey_points.append({'lat': current_lat, 'lng': current_lon, 'altitude': altitude + 10, 'action': 'photo'})
                        current_lat -= grid_spacing
                current_lon += grid_spacing
                col += 1
                
        send_message("status", f"Generated {len(survey_points)} survey points")
        return survey_points
        
    except ImportError:
        send_message("error", "Turf library not available, using simple grid pattern")
        # Fallback to simple grid if turf is not available
        lats, lons = [wp['lat'] for wp in waypoints], [wp['lng'] for wp in waypoints]
        min_lat, max_lat = min(lats), max(lats)
        min_lon, max_lon = min(lons), max(lons)
        
        survey_points = []
        grid_spacing = 0.0001
        current_lat, row = min_lat, 0
        
        while current_lat <= max_lat:
            if row % 2 == 0:
                for current_lon in [min_lon + i * grid_spacing for i in range(int((max_lon - min_lon) / grid_spacing) + 1)]:
                    survey_points.append({'lat': current_lat, 'lng': current_lon, 'altitude': altitude, 'action': 'photo'})
            else:
                for current_lon in reversed([min_lon + i * grid_spacing for i in range(int((max_lon - min_lon) / grid_spacing) + 1)]):
                    survey_points.append({'lat': current_lat, 'lng': current_lon, 'altitude': altitude, 'action': 'photo'})
            current_lat += grid_spacing
            row += 1
            
        if enhanced_3d:
            perpendicular_points = []
            current_lon, col = min_lon, 0
            while current_lon <= max_lon:
                if col % 2 == 0:
                    for current_lat in [min_lat + i * grid_spacing for i in range(int((max_lat - min_lat) / grid_spacing) + 1)]:
                        perpendicular_points.append({'lat': current_lat, 'lng': current_lon, 'altitude': altitude + 10, 'action': 'photo'})
                else:
                    for current_lat in reversed([min_lat + i * grid_spacing for i in range(int((max_lat - min_lat) / grid_spacing) + 1)]):
                        perpendicular_points.append({'lat': current_lat, 'lng': current_lon, 'altitude': altitude + 10, 'action': 'photo'})
                current_lon += grid_spacing
                col += 1
            survey_points.extend(perpendicular_points)
            
        return survey_points

# --- MODIFICATION: execute_mission is now synchronous ---
def execute_mission(mission_data: Dict):
    """Execute the drone mission."""
    global vehicle, is_mission_active, current_mission
    if not vehicle:
        send_message("error", "Cannot start mission, vehicle not connected.")
        return
        
    try:
        is_mission_active = True
        current_mission = MissionState()
        current_mission.start_time = time.time()
        
        waypoints = mission_data.get('waypoints', [])
        altitude = mission_data.get('altitude', 100) * 0.3048  # Convert feet to meters
        enhanced_3d = mission_data.get('enhanced3d', False)
        current_mission.waypoints = waypoints
        current_mission.altitude = altitude
        
        send_message("status", "Generating survey pattern...")
        survey_points = generate_survey_pattern(waypoints, altitude, enhanced_3d)
        
        if not survey_points:
            send_message("error", "Failed to generate survey pattern")
            is_mission_active = False
            return
            
        # Calculate area covered
        try:
            import turf
            polygon_coords = [[wp['lng'], wp['lat']] for wp in waypoints]
            polygon_coords.append(polygon_coords[0])  # Close the polygon
            polygon = turf.polygon([polygon_coords])
            area_m2 = turf.area(polygon)
            current_mission.area_covered = area_m2
            acres = area_m2 / 4046.86
        except ImportError:
            # Estimate area if turf is not available
            lats = [wp['lat'] for wp in waypoints]
            lons = [wp['lng'] for wp in waypoints]
            width = calculate_distance(min(lats), min(lons), min(lats), max(lons))
            height = calculate_distance(min(lats), min(lons), max(lats), min(lons))
            area_m2 = width * height
            current_mission.area_covered = area_m2
            acres = area_m2 / 4046.86
        
        send_message("mission_info", {
            "total_waypoints": len(survey_points),
            "estimated_time": len(survey_points) * 3,
            "coverage_pattern": "enhanced_3d" if enhanced_3d else "standard_grid",
            "area_covered_m2": area_m2,
            "area_covered_acres": acres
        })
        
        send_message("status", "Pre-flight checks...")

        # Wait for vehicle to be armable
        timeout, start_time = 30, time.time()
        while not vehicle.is_armable and time.time() - start_time < timeout: 
            time.sleep(1)
            
        if not vehicle.is_armable: 
            raise Exception("Vehicle not armable after 30s timeout")

        send_message("status", "Arming vehicle...")
        vehicle.mode = VehicleMode("GUIDED")
        vehicle.armed = True
        
        while not vehicle.armed and is_mission_active: 
            time.sleep(0.5)
            
        if not is_mission_active: 
            return

        send_message("status", f"Taking off to {altitude:.0f}m...")
        vehicle.simple_takeoff(altitude)
        
        while vehicle.location.global_relative_frame.alt < altitude * 0.95 and is_mission_active: 
            time.sleep(0.5)
        
        if not is_mission_active:
            send_message("status", "Mission cancelled during takeoff")
            vehicle.mode = VehicleMode("RTL")
            return
        
        send_message("status", "Takeoff complete, starting survey...")
        previous_position = vehicle.location.global_relative_frame
        
        for i, point in enumerate(survey_points):
            if not is_mission_active: 
                break
                
            send_message("status", f"Flying to survey point {i+1}/{len(survey_points)}")
            send_message("waypoint_progress", {
                "current": i + 1, 
                "total": len(survey_points), 
                "percentage": ((i + 1) / len(survey_points)) * 100
            })
            
            target_location = LocationGlobalRelative(point['lat'], point['lng'], point.get('altitude', altitude))
            vehicle.simple_goto(target_location, groundspeed=current_mission.flight_speed)
            
            # Calculate distance to this waypoint
            while is_mission_active:
                loc = vehicle.location.global_relative_frame
                distance = calculate_distance(loc.lat, loc.lon, point['lat'], point['lng'])
                
                # Update distance flown
                current_position = vehicle.location.global_relative_frame
                segment_distance = calculate_distance(
                    previous_position.lat, previous_position.lon,
                    current_position.lat, current_position.lon
                )
                current_mission.distance_flown += segment_distance
                previous_position = current_position
                
                if distance < 2: 
                    break
                time.sleep(0.2)
                
            if not is_mission_active: 
                break
            
            if point.get('action') == 'photo':
                current_mission.photos_taken += 1
                send_message("photo_taken", {
                    "photo_number": current_mission.photos_taken, 
                    "location": {
                        "lat": point['lat'], 
                        "lng": point['lng'], 
                        "altitude": point.get('altitude', altitude)
                    }
                })
                time.sleep(0.5)
        
        if is_mission_active:
            mission_duration = time.time() - current_mission.start_time
            send_message("mission_complete", {
                "photos_taken": current_mission.photos_taken,
                "waypoints_completed": len(survey_points),
                "distance_flown": current_mission.distance_flown,
                "area_covered": current_mission.area_covered,
                "mission_duration": mission_duration
            })
            send_message("status", "Mission complete - returning to launch")
        else:
            send_message("status", "Mission cancelled - returning to launch")
        
        vehicle.mode = VehicleMode("RTL")
        while vehicle.armed and is_mission_active: 
            time.sleep(1)
            
        send_message("simulation_end", "Landing complete")
        
    except Exception as e:
        send_message("error", f"Mission error: {str(e)}")
        if vehicle: 
            vehicle.mode = VehicleMode("RTL")
    finally:
        is_mission_active = False
        current_mission = None

# --- MODIFICATION: stream_telemetry is now synchronous ---
def stream_telemetry():
    """Stream real-time telemetry data in a loop."""
    global telemetry_active
    telemetry_active = True
    previous_position = None
    
    while telemetry_active:
        try:
            if vehicle and vehicle.armed:
                location = vehicle.location.global_relative_frame
                attitude = vehicle.attitude
                heading = math.degrees(attitude.yaw) if attitude.yaw else 0
                if heading < 0: 
                    heading += 360
                    
                velocity = vehicle.velocity
                ground_speed = math.sqrt(velocity[0]**2 + velocity[1]**2) if velocity[0] else 0
                
                # Calculate distance flown
                if previous_position and is_mission_active:
                    distance = calculate_distance(
                        previous_position.lat, previous_position.lon,
                        location.lat, location.lon
                    )
                    if current_mission:
                        current_mission.distance_flown += distance
                previous_position = location
                
                telemetry_data = {
                    "lat": location.lat, "lng": location.lon, "alt": location.alt,
                    "alt_feet": location.alt / 0.3048, "heading": heading,
                    "ground_speed": ground_speed,
                    "battery": vehicle.battery.level if vehicle.battery.level else 100,
                    "mode": str(vehicle.mode.name), "armed": vehicle.armed,
                    "gps_fix": vehicle.gps_0.fix_type if vehicle.gps_0 else 0
                }
                
                if is_mission_active and current_mission:
                    telemetry_data["mission_status"] = {
                        "active": True, 
                        "photos_taken": current_mission.photos_taken, 
                        "current_waypoint": current_mission.current_waypoint,
                        "distance_flown": current_mission.distance_flown
                    }
                    
                send_message("telemetry", telemetry_data)
            time.sleep(0.1)
        except Exception as e:
            send_message("error", f"Telemetry thread error: {e}")
            time.sleep(1)
    telemetry_active = False

# --- NEW: Function to handle commands from stdin in a thread ---
def handle_client_messages():
    """Handle incoming messages from stdin."""
    global is_mission_active, mission_task, sitl_process
    
    for line in sys.stdin:
        try:
            data = json.loads(line)
            command = data.get("command")
            
            if command == "start_mission":
                if is_mission_active:
                    send_message("error", "Mission already in progress")
                    continue
                    
                # Start SITL if not already running
                if not vehicle:
                    sitl_process = start_sitl()
                    if not sitl_process:
                        send_message("error", "Failed to start SITL simulator")
                        continue
                    
                    # Connect to drone
                    if not connect_to_drone():
                        send_message("error", "Failed to connect to drone")
                        continue
                
                mission_data = data.get("data", {})
                mission_task = threading.Thread(target=execute_mission, args=(mission_data,))
                mission_task.start()
                
            elif command == "stop_mission":
                if is_mission_active:
                    is_mission_active = False
                    send_message("status", "Stopping mission...")
                    if vehicle: 
                        vehicle.mode = VehicleMode("RTL")
                else:
                    send_message("warning", "No active mission to stop")
                    
            elif command == "emergency_land":
                if vehicle and vehicle.armed:
                    vehicle.mode = VehicleMode("LAND")
                    send_message("status", "Emergency landing initiated")
                    
            elif command == "get_status":
                status = {
                    "connected": vehicle is not None, 
                    "armed": vehicle.armed if vehicle else False, 
                    "mode": str(vehicle.mode.name) if vehicle else "Unknown", 
                    "mission_active": is_mission_active
                }
                send_message("vehicle_status", status)
                
            elif command == "shutdown":
                send_message("status", "Shutting down simulation...")
                if vehicle:
                    vehicle.close()
                if sitl_process:
                    sitl_process.stop()
                os._exit(0)
                
        except json.JSONDecodeError:
            send_message("error", "Invalid JSON message received from backend")
        except Exception as e:
            send_message("error", f"Command processing error: {str(e)}")

# --- NEW: Main execution block for synchronous script ---
if __name__ == "__main__":
    send_message("status", "Python simulation server started")
    
    # Start telemetry in a background thread
    telemetry_thread = threading.Thread(target=stream_telemetry, daemon=True)
    telemetry_thread.start()

    # Handle commands from stdin in the main thread
    try:
        handle_client_messages()
    except KeyboardInterrupt:
        send_message("status", "Shutdown signal received.")
    finally:
        if vehicle:
            send_message("status", "Closing vehicle connection.")
            vehicle.close()
        if sitl_process:
            sitl_process.stop()