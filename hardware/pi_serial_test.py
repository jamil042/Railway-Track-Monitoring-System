import serial
import time
import os
import json

SERIAL_PORT = '/dev/ttyACM0' 
BAUD_RATE = 115200

def clear_screen():
    # টার্মিনাল ক্লিয়ার করার জন্য
    os.system('cls' if os.name == 'nt' else 'clear')

def draw_dashboard(data):
    clear_screen()
    
    # কালার কোড (টার্মিনাল সুন্দর করার জন্য)
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    RESET = '\033[0m'
    BOLD = '\033[1m'
    
    print(f"{CYAN}{BOLD}===================================================={RESET}")
    print(f"{CYAN}{BOLD}   RAILWAY TRACK MONITORING SYSTEM - LIVE DASHBOARD {RESET}")
    print(f"{CYAN}{BOLD}===================================================={RESET}")
    print("")
    
    # ================= Vibration Sensors =================
    v1 = data.get('V1', 0)
    v2 = data.get('V2', 0)
    v1_status = f"{RED}VIBRATING{RESET}" if v1 > 0 else f"{GREEN}NORMAL{RESET}"
    v2_status = f"{RED}VIBRATING{RESET}" if v2 > 0 else f"{GREEN}NORMAL{RESET}"
    
    print(f"{BOLD}[ Vibration Sensors (SW-420) ]{RESET}")
    print(f"  Sensor 1 (Intensity: {v1:<4}): {v1_status}")
    print(f"  Sensor 2 (Intensity: {v2:<4}): {v2_status}")
    print("")
    
    # ================= IR Sensors =================
    # সাধারণত IR সেন্সরে বাধা পেলে 0 (LOW) এবং ক্লিয়ার থাকলে 1 (HIGH) আউটপুট আসে
    i1 = data.get('I1', 1)
    i2 = data.get('I2', 1)
    i1_status = f"{RED}OBSTACLE/FAULT DETECTED{RESET}" if i1 == 0 else f"{GREEN}CLEAR{RESET}"
    i2_status = f"{RED}OBSTACLE/FAULT DETECTED{RESET}" if i2 == 0 else f"{GREEN}CLEAR{RESET}"
    
    print(f"{BOLD}[ IR Sensors (Rail Continuity) ]{RESET}")
    print(f"  Sensor 1: {i1_status}")
    print(f"  Sensor 2: {i2_status}")
    print("")
    
    # ================= Ultrasonic Sensors =================
    u1 = data.get('U1', 0.0)
    u2 = data.get('U2', 0.0)
    
    u1_text = f"{u1:.1f} cm" if u1 > 0 else "Error/Out of Range"
    u2_text = f"{u2:.1f} cm" if u2 > 0 else "Error/Out of Range"
    
    print(f"{BOLD}[ Ultrasonic Sensors (Distance/Alignment) ]{RESET}")
    print(f"  Sensor 1: {YELLOW}{u1_text}{RESET}")
    print(f"  Sensor 2: {YELLOW}{u2_text}{RESET}")
    print("")
    
    print(f"{CYAN}===================================================={RESET}")
    print(f"Press {RED}Ctrl+C{RESET} to stop monitoring.")

def monitor_sensors():
    try:
        print(f"Connecting to ESP32 on {SERIAL_PORT}...")
        ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
        time.sleep(2) # ESP32 রিস্টার্ট হওয়ার সময়টুকু অপেক্ষা করা হচ্ছে
        
        while True:
            if ser.in_waiting > 0:
                line = ser.readline().decode('utf-8', errors='ignore').strip()
                # চেক করা হচ্ছে ডেটা JSON ফরম্যাটে এসেছে কি না
                if line.startswith('{') and line.endswith('}'):
                    try:
                        data = json.loads(line)
                        draw_dashboard(data) # সুন্দর করে টার্মিনালে দেখানো
                    except json.JSONDecodeError:
                        pass # JSON ভুল হলে ইগনোর করবে
                
    except serial.SerialException as e:
        print(f"\nError: Could not connect to {SERIAL_PORT}.")
        print(f"Details: {e}")
    except KeyboardInterrupt:
        print("\n\nMonitoring stopped by user.")
        if 'ser' in locals() and ser.is_open:
            ser.close()

if __name__ == '__main__':
    monitor_sensors()
