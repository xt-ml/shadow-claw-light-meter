// Wokwi Custom Chip Simulator for TinyCircuits ASD2112 Rev 2 (Bluegiga BLE112)
// Emulates the BGAPI packet-mode protocol at 38400 baud over Pins 3 (TX) and 4
// (RX).

#ifndef ARDUINO

#include "wokwi-api.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct {
  uart_dev_t uart;
  timer_t boot_timer;
  timer_t connect_timer;
  timer_t ping_timer;
  uint8_t rx_buf[64];
  uint8_t rx_pos;
  uint8_t expected_len;
  bool connected;
} chip_state_t;

// Send a raw BGAPI response/event back to the TinyDuino (SoftwareSerial RX on
// Pin 3)
static void send_bgapi(chip_state_t *chip, const uint8_t *pkt, uint8_t len) {
  uart_write(chip->uart, (uint8_t *)pkt, len);
}

// Simulates a Web Bluetooth client writing "LED_ON" or "PING" to GATT Handle 17
// (c_rx_data)
static void on_ping_timer(void *user_data) {
  chip_state_t *chip = (chip_state_t *)user_data;
  if (!chip->connected)
    return;

  // BGAPI ble_evt_attributes_value (0x80, len=11, class=0x02, id=0x00)
  // connection=0, reason=1, handle=17 (0x0011), offset=0 (0x0000), value_len=6,
  // value="LED_ON"
  const uint8_t evt_attr_val[] = {0x80, 0x0B, 0x02, 0x00, 0x00, 0x01,
                                  0x11, 0x00, 0x00, 0x00, 0x06, 'L',
                                  'E',  'D',  '_',  'O',  'N'};
  printf("[BLE112 Chip] Simulating Web Bluetooth GATT write: \"LED_ON\" "
         "(handle 17)\n");
  send_bgapi(chip, evt_attr_val, sizeof(evt_attr_val));
}

// Simulates a Web Bluetooth client connecting 2 seconds after advertising
// starts
static void on_connect_timer(void *user_data) {
  chip_state_t *chip = (chip_state_t *)user_data;
  chip->connected = true;

  // BGAPI ble_evt_connection_status (0x80, len=16, class=0x03, id=0x00)
  // connection=0, flags=0x05 (connected + completed), addr=01:02:03:04:05:06
  const uint8_t evt_conn[] = {0x80, 0x10, 0x03, 0x00, 0x00, 0x05, 0x06,
                              0x05, 0x04, 0x03, 0x02, 0x01, 0x00, 0x20,
                              0x00, 0x64, 0x00, 0x00, 0x00, 0xFF};
  printf("[BLE112 Chip] Simulated Chrome Web Bluetooth client connected!\n");
  send_bgapi(chip, evt_conn, sizeof(evt_conn));

  // Trigger a simulated command write 2 seconds after connecting
  timer_start(chip->ping_timer, 2000000, false);
}

// Emits the exact 16-byte system_boot packet from README.md on power-up
static void on_boot_timer(void *user_data) {
  chip_state_t *chip = (chip_state_t *)user_data;
  const uint8_t boot_pkt[] = {0x80, 0x0C, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
                              0x01, 0x00, 0x47, 0x00, 0x03, 0x00, 0x01, 0x01};
  printf(
      "[BLE112 Chip] Power-on boot -> sending system_boot (80 0C 00 00...)\n");
  send_bgapi(chip, boot_pkt, sizeof(boot_pkt));
}

static void handle_bgapi_command(chip_state_t *chip, const uint8_t *cmd,
                                 uint8_t len) {
  if (len < 4)
    return;
  uint8_t cls = cmd[2];
  uint8_t id = cmd[3];

  // System class (0x00)
  if (cls == 0x00 && id == 0x01) { // system_hello
    const uint8_t rsp[] = {0x00, 0x00, 0x00, 0x01};
    send_bgapi(chip, rsp, sizeof(rsp));
  } else if (cls == 0x00 && id == 0x02) { // system_address_get
    const uint8_t rsp[] = {0x00, 0x06, 0x00, 0x02, 0xAA,
                           0xBB, 0xCC, 0x07, 0x80, 0x00};
    send_bgapi(chip, rsp, sizeof(rsp));
  }
  // Attributes class (0x02)
  else if (cls == 0x02 &&
           id == 0x00) { // attributes_write (TinyDuino -> Web Bluetooth TX)
    const uint8_t rsp[] = {0x00, 0x02, 0x02, 0x00, 0x00, 0x00};
    send_bgapi(chip, rsp, sizeof(rsp));
  }
  // GAP class (0x06)
  else if (cls == 0x06 && id == 0x08) { // gap_set_adv_parameters
    const uint8_t rsp[] = {0x00, 0x02, 0x06, 0x08, 0x00, 0x00};
    send_bgapi(chip, rsp, sizeof(rsp));
  } else if (cls == 0x06 && id == 0x09) { // gap_set_adv_data
    const uint8_t rsp[] = {0x00, 0x02, 0x06, 0x09, 0x00, 0x00};
    send_bgapi(chip, rsp, sizeof(rsp));
  } else if (cls == 0x06 && id == 0x01) { // gap_set_mode (Start Advertising!)
    const uint8_t rsp[] = {0x00, 0x02, 0x06, 0x01, 0x00, 0x00};
    printf("[BLE112 Chip] Advertising started! Scheduling simulated Web "
           "Bluetooth client in 2s...\n");
    send_bgapi(chip, rsp, sizeof(rsp));
    timer_start(chip->connect_timer, 2000000, false);
  }
  // Hardware class (0x07)
  else if (cls == 0x07 && id == 0x0C) { // hardware_set_txpower
    const uint8_t rsp[] = {0x00, 0x00, 0x07, 0x0C};
    send_bgapi(chip, rsp, sizeof(rsp));
  }
}

static void on_uart_rx(void *user_data, uint8_t byte) {
  chip_state_t *chip = (chip_state_t *)user_data;

  // Handle packetMode=1 leading length byte or packetMode=0 header
  if (chip->rx_pos == 0) {
    if (byte > 0 && byte < 60) {
      // packetMode = 1 length prefix
      chip->expected_len = byte;
      chip->rx_pos = 1;
      return;
    } else if (byte == 0x00) {
      // packetMode = 0 start of command
      chip->rx_buf[0] = 0x00;
      chip->rx_pos = 2; // special marker for packetMode=0
      chip->expected_len = 0;
      return;
    }
    return;
  }

  // Accumulate bytes in packetMode=1
  if (chip->expected_len > 0) {
    chip->rx_buf[chip->rx_pos - 1] = byte;
    chip->rx_pos++;
    if (chip->rx_pos - 1 == chip->expected_len) {
      handle_bgapi_command(chip, chip->rx_buf, chip->expected_len);
      chip->rx_pos = 0;
      chip->expected_len = 0;
    }
  }
}

void chip_init(void) {
  chip_state_t *chip = calloc(1, sizeof(chip_state_t));

  const uart_config_t uart_config = {
      .tx = pin_init("TX", INPUT_PULLUP),
      .rx = pin_init("RX", INPUT),
      .baud_rate = 38400,
      .rx_data = on_uart_rx,
      .user_data = chip,
  };
  chip->uart = uart_init(&uart_config);

  const timer_config_t boot_cfg = {.callback = on_boot_timer,
                                   .user_data = chip};
  chip->boot_timer = timer_init(&boot_cfg);

  const timer_config_t conn_cfg = {.callback = on_connect_timer,
                                   .user_data = chip};
  chip->connect_timer = timer_init(&conn_cfg);

  const timer_config_t ping_cfg = {.callback = on_ping_timer,
                                   .user_data = chip};
  chip->ping_timer = timer_init(&ping_cfg);

  // Fire system_boot 200ms after simulation starts
  timer_start(chip->boot_timer, 200000, false);
}
#endif // !ARDUINO
