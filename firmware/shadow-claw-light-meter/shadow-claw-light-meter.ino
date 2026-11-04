// ShadowClaw LightMeter — TinyDuino + ASD2112 (Bluegiga BLE112) Production
// Firmware Board: Arduino Pro or Pro Mini | Processor: ATmega328P (3.3V, 8 MHz)
// Wokwi Simulator: https://wokwi.com/projects/479603659463545857
//
// Hardware Wiring (KY-018 3-Pin Photoresistor Light Sensor on ASD2009 Proto
// Board):
//   Light Sensor [-] -> TinyDuino GND
//   Light Sensor [+] -> TinyDuino VCC (3.3V)
//   Light Sensor [S] -> TinyDuino A0
//   Aux Status LED   -> TinyDuino D7 (through 220Ω resistor to GND)

#include "BGLib.h"
#include <SoftwareSerial.h>

#define DEBUG

// ================================================================
// BLE STATE TRACKING
// ================================================================

#define BLE_STATE_STANDBY 0
#define BLE_STATE_SCANNING 1
#define BLE_STATE_ADVERTISING 2
#define BLE_STATE_CONNECTING 3
#define BLE_STATE_CONNECTED_MASTER 4
#define BLE_STATE_CONNECTED_SLAVE 5

uint8_t ble_state = BLE_STATE_STANDBY;
uint8_t ble_encrypted = 0;  // 0 = not encrypted, otherwise = encrypted
uint8_t ble_bonding = 0xFF; // 0xFF = no bonding, otherwise = bonding handle
bool ble_advertising_confirmed = false;
unsigned long lastAdvCheck = 0;

// ================================================================
// HARDWARE CONNECTIONS AND GATT STRUCTURE SETUP
// ================================================================

#define LED_PIN 13        // Onboard TinyDuino status LED
#define AUX_LED_PIN 7     // ASD2009 Proto Board auxiliary LED (D7)
#define LDR_ANALOG_PIN A0 // KY-018 Photoresistor AO (Analog Light Level)

// Stock BGLib_U1A1P_38400_noflow GATT handles:
// Service: 195ae58a-437a-489b-b0cd-b7c9c394bae4
// c_rx_data (5fc569a0-74a9-4fa4-b8b7-8354c86e45a4): handle 17 (0x11), write
// c_tx_data (21819ab0-c937-4188-b0db-b9621e1696cd): handle 20 (0x14), read /
// notify / indicate
#define GATT_HANDLE_C_RX_DATA 17
#define GATT_HANDLE_C_TX_DATA 20

// BLE112 TinyShield Rev 2 Connections:
// Pin 3 is BLE_TX (out of BLE module -> Arduino Soft RX)
// Pin 4 is BLE_RX (out of Arduino Soft TX -> BLE module)
SoftwareSerial bleSerialPort(3, 4);

// IMPORTANT: Stock ASD2112 Rev 2 firmware uses packetMode = 1 (leading length
// byte on TX). Sending packetMode = 0 frames causes the BLE112's DMA UART to
// wait for bytes and brown-out on RF TX!
BGLib ble112((HardwareSerial *)&bleSerialPort, 0, 1);

#define BGAPI_GET_RESPONSE(v, dType)                                           \
  dType *v = (dType *)ble112.getLastRXPayload()

bool ledOverride = false;
bool ledOverrideState = false;
bool ledNightlightMode = false;
unsigned long lastTelemetryTime = 0;
uint16_t telemetryIntervalMs = 500;
bool telemetryEnabled = false;

// Sensor State
int16_t lastLightRaw = 0;
int16_t lightMinSeen = 1023;
int16_t lightMaxSeen = 0;

// Forward declarations
void onBusy();
void onIdle();
void onTimeout();
void configureAndStartAdvertising();
int16_t readLightSensor();
void sendLightToWebBluetooth();
void setLedHardware(bool on);
void my_ble_evt_system_boot(const ble_msg_system_boot_evt_t *msg);
void my_ble_evt_connection_status(const ble_msg_connection_status_evt_t *msg);
void my_ble_evt_connection_disconnect(
    const struct ble_msg_connection_disconnected_evt_t *msg);
void my_ble_evt_attributes_value(
    const struct ble_msg_attributes_value_evt_t *msg);
void my_ble_rsp_gap_set_mode(const struct ble_msg_gap_set_mode_rsp_t *msg);
void sendToWebBluetooth(const char *str);
void sendBytesToWebBluetooth(const uint8_t *data, uint8_t len);
void handleIncomingCommand(const uint8_t *data, uint8_t len);

// ================================================================
// ADVERTISING SETUP (PACKET MODE = 1 ONLY)
// ================================================================

void configureAndStartAdvertising() {
  Serial.println(F(
      "\n[BLE] Configuring low-power RF & GAP advertising (packetMode=1)..."));

  // 1. Reduce BLE112 RF TX power to level 3 (~ -12dBm) to prevent 3.3V
  // brown-out resets on the TinyShield's LDO regulator when the radio turns on!
  ble112.ble_cmd_hardware_set_txpower(3);
  while (ble112.checkActivity(500))
    ;

  // 2. Set advertisement interval to 200-300ms (320-480 * 625us) on all 3
  // channels
  ble112.ble_cmd_gap_set_adv_parameters(320, 480, 7);
  while (ble112.checkActivity(500))
    ;

  // 3. Put module into GENERAL_DISCOVERABLE + UNDIRECTED_CONNECTABLE mode first
  // (uses the BLE112's built-in advertisement & scan-response data from
  // gatt.xml)
  ble112.ble_cmd_gap_set_mode(BGLIB_GAP_GENERAL_DISCOVERABLE,
                              BGLIB_GAP_UNDIRECTED_CONNECTABLE);
  while (ble112.checkActivity(500))
    ;

  ble_state = BLE_STATE_ADVERTISING;
}

// ================================================================
// KY-018 LIGHT SENSOR DRIVER
// ================================================================

// Reads the 3-pin Photoresistor Light Sensor wired to A0 (- -> GND, + -> VCC, S
// -> A0) Averages 4 ADC samples after a settle read to minimize analog jitter.
int16_t readLightSensor() {
  (void)analogRead(LDR_ANALOG_PIN); // Settle ADC mux on A0
  uint16_t sum = 0;
  for (uint8_t i = 0; i < 4; i++) {
    sum += (uint16_t)analogRead(LDR_ANALOG_PIN);
  }
  int16_t raw = (int16_t)(sum >> 2);
  lastLightRaw = raw;
  if (raw < lightMinSeen)
    lightMinSeen = raw;
  if (raw > lightMaxSeen)
    lightMaxSeen = raw;
  return raw;
}

void sendLightToWebBluetooth() {
  int16_t raw = readLightSensor();
  char msg[20];
  snprintf(msg, sizeof(msg), "LIGHT:%d A0:%d", raw, raw);
  Serial.print(F("[LIGHT] "));
  Serial.println(msg);
  sendToWebBluetooth(msg);
}

void setLedHardware(bool on) {
  digitalWrite(LED_PIN, on ? HIGH : LOW);
  digitalWrite(AUX_LED_PIN, on ? HIGH : LOW);
}

// ================================================================
// SETUP AND LOOP
// ================================================================

void setup() {
  pinMode(LED_PIN, OUTPUT);
  pinMode(AUX_LED_PIN, OUTPUT);
  setLedHardware(false);

  // Initialize KY-018 Photoresistor on A0
  pinMode(LDR_ANALOG_PIN, INPUT);

  // Set up BGLib internal status handlers
  ble112.onBusy = onBusy;
  ble112.onIdle = onIdle;
  ble112.onTimeout = onTimeout;

  // Set up BGLib event & response handlers
  ble112.ble_evt_system_boot = my_ble_evt_system_boot;
  ble112.ble_evt_connection_status = my_ble_evt_connection_status;
  ble112.ble_evt_connection_disconnected = my_ble_evt_connection_disconnect;
  ble112.ble_evt_attributes_value = my_ble_evt_attributes_value;
  ble112.ble_rsp_gap_set_mode = my_ble_rsp_gap_set_mode;

  // Open BLE SoftwareSerial port FIRST before any other Serial activity
  bleSerialPort.begin(38400);

  // Open USB serial for debugging at 115200 baud
  Serial.begin(115200);
  while (!Serial)
    ;

  Serial.println(F("======================================"));
  Serial.println(F("TinyDuino Web Bluetooth LightMeter    "));
  Serial.println(F("======================================"));

  // Take an initial Light Sensor (A0) reading on startup
  int16_t initLight = readLightSensor();
  Serial.print(F("[INIT] Light Sensor (A0) Ready -> A0:"));
  Serial.println(initLight);

  // Wake/query the BLE112 using a clean packetMode=1 system_hello command
  Serial.println(F("[INIT] Sending packetMode=1 system_hello..."));
  ble112.ble_cmd_system_hello();
  while (ble112.checkActivity(500))
    ;

  // Clear any lingering connection on handle 0
  Serial.println(
      F("[INIT] Clearing any lingering BLE112 connection (handle 0)..."));
  ble112.ble_cmd_connection_disconnect(0);
  while (ble112.checkActivity(500))
    ;
  delay(100);

  // Start advertising
  configureAndStartAdvertising();
  lastAdvCheck = millis();
}

void loop() {
  // Poll for incoming BGAPI serial packets from the BLE112 chip
  ble112.checkActivity();

  // If advertising hasn't been confirmed yet, retry every 4 seconds using clean
  // packetMode=1 commands
  if (!ble_advertising_confirmed && (millis() - lastAdvCheck >= 4000)) {
    lastAdvCheck = millis();
    configureAndStartAdvertising();
  }

  // Forward any text typed into the Arduino USB Serial Monitor over BLE
  if (Serial.available()) {
    uint8_t buf[20];
    uint8_t len = 0;
    while (Serial.available() && len < 20) {
      buf[len++] = Serial.read();
    }
    if (len > 0) {
      sendBytesToWebBluetooth(buf, len);
    }
  }

  // Periodic telemetry when connected and STREAM_ON is enabled
  if (ble_state == BLE_STATE_CONNECTED_SLAVE && telemetryEnabled) {
    if (millis() - lastTelemetryTime >= telemetryIntervalMs) {
      lastTelemetryTime = millis();
      int16_t raw = readLightSensor();

      char msg[20];
      snprintf(msg, sizeof(msg), "A0:%d", raw);
      Serial.print(F("[STREAM] "));
      Serial.println(msg);
      sendToWebBluetooth(msg);
    }
  }

  // Drive LEDs: Nightlight mode (A0 threshold), manual override, or BLE status
  // blink
  if (ledNightlightMode) {
    int16_t raw = readLightSensor();
    // Circuit: +VCC -> LDR -> S(A0) -> 10kΩ -> -GND (Dark = low A0 < 70, Bright
    // = high A0 > 120)
    if (raw < 70) {
      ledOverrideState = true;
    } else if (raw > 120) {
      ledOverrideState = false;
    }
    setLedHardware(ledOverrideState);
  } else if (ledOverride) {
    setLedHardware(ledOverrideState);
  } else {
    // Automatic LED status: Solid ON when BLE connected, 1 Hz blink when
    // advertising
    if (ble_state == BLE_STATE_CONNECTED_SLAVE) {
      setLedHardware(true);
    } else if (ble_state == BLE_STATE_ADVERTISING) {
      setLedHardware((millis() % 1000) < 150);
    } else {
      setLedHardware(false);
    }
  }
}

// ================================================================
// BLE NOTIFICATION / INDICATION HELPERS
// ================================================================

void sendBytesToWebBluetooth(const uint8_t *data, uint8_t len) {
  if (ble_state != BLE_STATE_CONNECTED_SLAVE)
    return;
  if (len == 0)
    return;
  if (len > 20)
    len = 20;

  ble112.ble_cmd_attributes_write(GATT_HANDLE_C_TX_DATA, 0, len,
                                  (uint8_t *)data);
  while (ble112.checkActivity(200))
    ;
}

void sendToWebBluetooth(const char *str) {
  sendBytesToWebBluetooth((const uint8_t *)str, strlen(str));
}

// ================================================================
// WEB BLUETOOTH COMMAND DISPATCHER
// ================================================================

void handleIncomingCommand(const uint8_t *data, uint8_t len) {
  char cmd[21];
  uint8_t copyLen = len < 20 ? len : 20;
  memcpy(cmd, data, copyLen);
  cmd[copyLen] = '\0';

  // Trim trailing carriage return / newline
  while (copyLen > 0 && (cmd[copyLen - 1] == '\r' || cmd[copyLen - 1] == '\n' ||
                         cmd[copyLen - 1] == ' ')) {
    cmd[--copyLen] = '\0';
  }

  Serial.print(F("[BLE CMD] \""));
  Serial.print(cmd);
  Serial.println(F("\""));

  if (strcmp(cmd, "LED_ON") == 0 || strcmp(cmd, "LED:ON") == 0) {
    ledNightlightMode = false;
    ledOverride = true;
    ledOverrideState = true;
    setLedHardware(true);
    sendToWebBluetooth("ACK:LED_ON");
  } else if (strcmp(cmd, "LED_OFF") == 0 || strcmp(cmd, "LED:OFF") == 0) {
    ledNightlightMode = false;
    ledOverride = true;
    ledOverrideState = false;
    setLedHardware(false);
    sendToWebBluetooth("ACK:LED_OFF");
  } else if (strcmp(cmd, "LED_AUTO") == 0 || strcmp(cmd, "LED:AUTO") == 0) {
    ledNightlightMode = false;
    ledOverride = false;
    sendToWebBluetooth("ACK:LED_AUTO");
  } else if (strcmp(cmd, "LED_LIGHT") == 0 ||
             strcmp(cmd, "LED:NIGHTLIGHT") == 0) {
    ledNightlightMode = true;
    ledOverride = false;
    sendToWebBluetooth("ACK:LED_LIGHT");
  } else if (strcmp(cmd, "LIGHT") == 0 || strcmp(cmd, "LDR") == 0) {
    sendLightToWebBluetooth();
  } else if (strcmp(cmd, "PING") == 0) {
    char reply[20];
    snprintf(reply, sizeof(reply), "PONG %lus", millis() / 1000);
    sendToWebBluetooth(reply);
  } else if (strcmp(cmd, "STATUS") == 0) {
    int16_t raw = readLightSensor();
    char reply[20];
    snprintf(reply, sizeof(reply), "A0:%d LED:%s", raw,
             ledNightlightMode
                 ? "LDR"
                 : (ledOverride ? (ledOverrideState ? "ON" : "OFF") : "AUTO"));
    Serial.print(F("[STATUS] "));
    Serial.println(reply);
    sendToWebBluetooth(reply);
  } else if (strcmp(cmd, "STREAM_ON") == 0) {
    telemetryEnabled = true;
    lastTelemetryTime = 0; // Trigger immediate first sample on next loop tick
    sendToWebBluetooth("ACK:STREAM_ON");
  } else if (strcmp(cmd, "STREAM_OFF") == 0) {
    telemetryEnabled = false;
    sendToWebBluetooth("ACK:STREAM_OFF");
  } else if (strncmp(cmd, "RATE:", 5) == 0) {
    int rate = atoi(cmd + 5);
    if (rate >= 100 && rate <= 10000) {
      telemetryIntervalMs = (uint16_t)rate;
    }
    char reply[20];
    snprintf(reply, sizeof(reply), "ACK:RATE:%u", telemetryIntervalMs);
    sendToWebBluetooth(reply);
  } else {
    char reply[20];
    snprintf(reply, sizeof(reply), "ECHO:%.*s", 14, cmd);
    sendToWebBluetooth(reply);
  }
}

// ================================================================
// INTERNAL BGLIB CLASS CALLBACK FUNCTIONS
// ================================================================

void onBusy() {}
void onIdle() {}
void onTimeout() {}

// ================================================================
// BGLIB EVENT & RESPONSE HANDLERS
// ================================================================

void my_ble_evt_system_boot(const ble_msg_system_boot_evt_t *msg) {
  Serial.print(F("###\tboot\tmajor="));
  Serial.print(msg->major);
  Serial.print(F(", minor="));
  Serial.print(msg->minor);
  Serial.print(F(", build="));
  Serial.println(msg->build);

  ble_advertising_confirmed = false;
  configureAndStartAdvertising();
}

void my_ble_rsp_gap_set_mode(const struct ble_msg_gap_set_mode_rsp_t *msg) {
  if (msg->result == 0) {
    ble_advertising_confirmed = true;
    Serial.println(F("[BLE] Advertising active -> Visible to Web Bluetooth!"));
  } else {
    Serial.print(F("[BLE ERR] gap_set_mode failed: 0x"));
    Serial.println(msg->result, HEX);
  }
}

void my_ble_evt_connection_status(const ble_msg_connection_status_evt_t *msg) {
  Serial.print(F("###\tconnection_status\tflags="));
  Serial.print(msg->flags, HEX);
  Serial.print(F(", handle="));
  Serial.println(msg->connection);

  if ((msg->flags & 0x05) == 0x05) {
    Serial.println(F("[BLE] Connected to host (Web Bluetooth client online)!"));
    ble_state = BLE_STATE_CONNECTED_SLAVE;
    telemetryEnabled = false;
    setLedHardware(true);
  }
}

void my_ble_evt_connection_disconnect(
    const struct ble_msg_connection_disconnected_evt_t *msg) {
  Serial.print(F("###\tdisconnected\thandle="));
  Serial.print(msg->connection);
  Serial.print(F(", reason=0x"));
  Serial.println(msg->reason, HEX);

  ble_state = BLE_STATE_STANDBY;
  ble_advertising_confirmed = false;
  telemetryEnabled = false;
  setLedHardware(false);

  configureAndStartAdvertising();
  lastAdvCheck = millis();
}

void my_ble_evt_attributes_value(
    const struct ble_msg_attributes_value_evt_t *msg) {
  if (msg->handle == GATT_HANDLE_C_RX_DATA) {
    handleIncomingCommand(msg->value.data, msg->value.len);
  }
}
