# backend/scripts/drone_mission.py
import sys
import json
import time
import math
from dronekit import connect, VehicleMode, Command, LocationGlobalRelative

# --- MODIFIED: Connection string to match Mission Planner's TCP output for Helicopter SITL ---
# This tells DroneKit to connect to the specific TCP port you see in Mission Planner.
CONNECTION_STRING = 'tcp:127.0.0.1:5760'

def get_bearing(location1, location2):
    """Calculates the bearing (heading) between two GPS coordinates."""
    dLon = location2.lon - location1.lon
    y = math.sin(dLon) * math.cos(location2.lat)
    x = math.cos(location1.lat) * math.sin(location2.lat) - math.sin(location1.lat) * math.cos(location2.lat) * math.cos(dLon)
    bearing = math.degrees(math.atan2(y, x))
    return (bearing + 360) % 360

def run_mission():
    vehicle = None  # Initialize vehicle to None
    try:
        # --- Load Mission Data from Node.js ---
        if len(sys.argv) != 2:
            print(json.dumps({"error": "Mission data not provided."}), flush=True)
            sys.exit(1)
        
        mission_data = json.loads(sys.argv[1])
        altitude = mission_data.get("altitude", 30)
        waypoints_data = mission_data.get("waypoints", [])

        # --- Connect to the existing Mission Planner SITL vehicle ---
        print(json.dumps({"status": f"Connecting to vehicle on {CONNECTION_STRING}..."}), flush=True)
        # We add a timeout to handle the case where Mission Planner isn't running.
        vehicle = connect(CONNECTION_STRING, wait_ready=True, timeout=60)
        print(json.dumps({"status": "Vehicle connected successfully!"}), flush=True)

        # --- Build and Upload Mission ---
        print(json.dumps({"status": "Building and uploading mission..."}), flush=True)
        cmds = vehicle.commands
        cmds.download()
        cmds.wait_ready()
        cmds.clear()
        
        takeoff_alt_meters = float(altitude) * 0.3048  # Convert feet to meters
        
        # Add a takeoff command (MAV_CMD_NAV_TAKEOFF)
        cmds.add(Command(0, 0, 0, 3, 22, 0, 0, 0, 0, 0, 0, 0, 0, takeoff_alt_meters))
        
        # Add waypoints from the flight plan (MAV_CMD_NAV_WAYPOINT)
        for point in waypoints_data:
            cmds.add(Command(0, 0, 0, 3, 16, 0, 0, 0, 0, 0, 0, point['lat'], point['lng'], takeoff_alt_meters))
        
        # Add RTL (Return to Launch) command at the end (MAV_CMD_NAV_RETURN_TO_LAUNCH)
        cmds.add(Command(0, 0, 0, 3, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0))
        
        cmds.upload()
        print(json.dumps({"status": "Mission uploaded."}), flush=True)

        # --- Execute Mission ---
        while not vehicle.is_armable:
            print(json.dumps({"status": "Waiting for vehicle to become armable..."}), flush=True)
            time.sleep(1)
        
        vehicle.mode = VehicleMode("GUIDED")
        vehicle.armed = True
        
        while not vehicle.armed:
            print(json.dumps({"status": "Waiting for arming..."}), flush=True)
            time.sleep(1)

        print(json.dumps({"status": "Vehicle Armed! Starting mission..."}), flush=True)
        vehicle.mode = VehicleMode("AUTO")

        # --- Monitor Mission and Stream Telemetry ---
        while True:
            current_location = vehicle.location.global_relative_frame
            
            heading = vehicle.attitude.yaw * 180 / math.pi
            if heading < 0:
                heading += 360

            telemetry = {
                "lat": current_location.lat,
                "lng": current_location.lon,
                "alt": current_location.alt,
                "heading": heading
            }
            print(json.dumps(telemetry), flush=True)
            
            # End condition: Once RTL is engaged and altitude is low, the mission is over.
            if vehicle.mode.name == "RTL" and current_location.alt < 1.0:
                break
            
            # A failsafe in case RTL mode isn't triggered properly
            if vehicle.commands.next == vehicle.commands.count and current_location.alt < 1.0:
                 break

            time.sleep(0.1)

        print(json.dumps({"status": "Mission complete. Vehicle has returned to launch."}), flush=True)

    except Exception as e:
        # This will catch connection timeouts or other errors.
        print(json.dumps({"error": f"An error occurred: {e}"}), flush=True)
    finally:
        if vehicle:
            print(json.dumps({"status": "Closing vehicle connection."}), flush=True)
            vehicle.close()

if __name__ == "__main__":
    run_mission()