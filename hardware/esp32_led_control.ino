// Vibration Sensors (SW-420)
const int vibSensor1 = 32;
const int vibSensor2 = 33;
int vibCount1 = 0;
int vibCount2 = 0;

// IR Sensors
const int irSensor1 = 25;
const int irSensor2 = 26;

// Ultrasonic Sensors (HC-SR04)
const int trig1 = 27;
const int echo1 = 14;
const int trig2 = 18;
const int echo2 = 19;

unsigned long lastSendTime = 0;
const int sendInterval = 500; // 500ms পরপর ডেটা পাঠাবে

void setup() {
  Serial.begin(115200);
  
  // Vibration Pins
  pinMode(vibSensor1, INPUT);
  pinMode(vibSensor2, INPUT);
  
  // IR Pins
  pinMode(irSensor1, INPUT);
  pinMode(irSensor2, INPUT);
  
  // Ultrasonic Pins
  pinMode(trig1, OUTPUT);
  pinMode(echo1, INPUT);
  pinMode(trig2, OUTPUT);
  pinMode(echo2, INPUT);
}

// আল্ট্রাসনিক সেন্সর থেকে দূরত্ব মাপার ফাংশন
float getDistance(int trigPin, int echoPin) {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);
  
  // 30ms টাইমআউট (যাতে সেন্সর হ্যাং না হয়)
  long duration = pulseIn(echoPin, HIGH, 30000); 
  if (duration == 0) return -1.0; // এরর বা রেঞ্জের বাইরে হলে -1 রিটার্ন করবে
  return (duration * 0.0343) / 2.0; // সেন্টিমিটারে দূরত্ব (cm)
}

void loop() {
  // ভাইব্রেশন রিড করা
  if (digitalRead(vibSensor1) == HIGH) vibCount1++;
  if (digitalRead(vibSensor2) == HIGH) vibCount2++;

  unsigned long currentTime = millis();
  if (currentTime - lastSendTime >= sendInterval) {
    // IR রিড করা
    int ir1 = digitalRead(irSensor1);
    int ir2 = digitalRead(irSensor2);
    
    // Ultrasonic রিড করা
    float dist1 = getDistance(trig1, echo1);
    float dist2 = getDistance(trig2, echo2);
    
    // ডেটা JSON ফরম্যাটে পিসিতে পাঠানো
    Serial.print("{");
    Serial.print("\"V1\":"); Serial.print(vibCount1); Serial.print(",");
    Serial.print("\"V2\":"); Serial.print(vibCount2); Serial.print(",");
    Serial.print("\"I1\":"); Serial.print(ir1); Serial.print(",");
    Serial.print("\"I2\":"); Serial.print(ir2); Serial.print(",");
    Serial.print("\"U1\":"); Serial.print(dist1); Serial.print(",");
    Serial.print("\"U2\":"); Serial.print(dist2);
    Serial.println("}");

    // কাউন্টার রিসেট করা
    vibCount1 = 0;
    vibCount2 = 0;
    lastSendTime = currentTime;
  }
  
  delay(1); 
}
