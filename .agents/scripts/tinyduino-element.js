/**
 * .agents/scripts/tinyduino-element.js
 *
 * Custom Elements for TinyDuino LightMeter workbench:
 * - <tinyduino-control-panel>
 * - <tinyduino-lightmeter>
 * - <tinyduino-sensor-card>
 * - <tinyduino-packet-inspector>
 */

import { tinyduino } from "./tinyduino-ble.js";

const STYLES = `
:host {
  display: block;
  font-family: var(--shadow-claw-font-sans, system-ui, -apple-system, sans-serif);
  color: var(--shadow-claw-text-primary, #dde4e4);
  --bg-card: var(--shadow-claw-bg-secondary, rgb(26 33 33));
  --bg-elevated: var(--shadow-claw-bg-tertiary, rgb(37 43 44));
  --border: var(--shadow-claw-border-color, rgb(63 72 73));
  --accent: var(--shadow-claw-accent-primary, rgb(128 212 219));
  --accent-hover: var(--shadow-claw-accent-hover, rgb(157 240 248));
  --on-accent: var(--shadow-claw-on-primary, rgb(0 54 58));
  --success: var(--shadow-claw-success-color, rgb(92 219 167));
  --danger: var(--shadow-claw-error-color, rgb(255 180 171));
  --mono: var(--shadow-claw-font-mono, "JetBrains Mono", ui-monospace, monospace);
}

.card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--shadow-claw-radius-m, 12px);
  padding: 1.25rem;
  margin-bottom: 1.25rem;
  box-shadow: var(--shadow-claw-shadow-sm, 0 4px 6px -1px rgba(0, 0, 0, 0.2));
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.card-title {
  font-size: 1.1rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  color: var(--shadow-claw-text-primary);
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.75rem;
  font-family: var(--mono);
  padding: 0.2rem 0.6rem;
  border-radius: 9999px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
}
.status-badge.connected {
  border-color: var(--success);
  color: var(--success);
}
.status-badge.simulated {
  border-color: var(--accent);
  color: var(--accent);
}
.status-badge.disconnected {
  border-color: var(--border);
  color: var(--shadow-claw-text-tertiary, #899393);
}

.grid-3 {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1rem;
}

.btn {
  background: var(--bg-elevated);
  color: var(--shadow-claw-text-primary, #dde4e4);
  border: 1px solid var(--border);
  border-radius: var(--shadow-claw-radius-s, 6px);
  padding: 0.45rem 0.85rem;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}
.btn:hover:not(:disabled) {
  border-color: var(--accent);
  background: var(--shadow-claw-accent-secondary, rgb(0 79 84));
  color: var(--accent-hover);
}
.btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.btn-primary {
  background: var(--accent);
  color: var(--on-accent);
  border-color: var(--accent);
}
.btn-primary:hover:not(:disabled) {
  background: var(--accent-hover);
  color: var(--on-accent);
  border-color: var(--accent-hover);
}

/* LightMeter Visualizer */
.lightmeter-layout {
  display: grid;
  grid-template-columns: 200px 1fr;
  gap: 1.5rem;
  align-items: center;
}
@media (max-width: 700px) {
  .lightmeter-layout {
    grid-template-columns: 1fr;
  }
}

.gauge-box {
  background: var(--shadow-claw-bg-primary, rgb(14 20 21));
  border: 2px solid var(--border);
  border-radius: var(--shadow-claw-radius-m, 12px);
  height: 180px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  position: relative;
  overflow: hidden;
}
.gauge-pct {
  font-size: 2.4rem;
  font-weight: 800;
  font-family: var(--mono);
  color: var(--success);
}
.gauge-zone {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--shadow-claw-text-tertiary, #899393);
}

.kpi-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 0.75rem;
  margin-bottom: 1rem;
}
.kpi-tile {
  background: var(--shadow-claw-bg-primary, rgb(14 20 21));
  border: 1px solid var(--border);
  border-radius: var(--shadow-claw-radius-s, 8px);
  padding: 0.65rem 0.85rem;
}
.kpi-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  color: var(--shadow-claw-text-tertiary, #899393);
  font-weight: 600;
  letter-spacing: 0.03em;
}
.kpi-val {
  font-size: 1.25rem;
  font-weight: 700;
  font-family: var(--mono);
  margin-top: 0.15rem;
  color: var(--shadow-claw-text-primary);
}
.kpi-sub {
  font-size: 0.68rem;
  color: var(--shadow-claw-text-secondary, #b1cbce);
}

/* Chart Canvas */
.waveform-container {
  background: var(--shadow-claw-bg-primary, rgb(14 20 21));
  border: 1px solid var(--border);
  border-radius: var(--shadow-claw-radius-s, 8px);
  padding: 0.5rem;
  height: 90px;
  position: relative;
}
canvas.waveform {
  width: 100%;
  height: 100%;
  display: block;
}

/* Packet log */
.packet-log {
  background: var(--shadow-claw-bg-primary, rgb(14 20 21));
  border: 1px solid var(--border);
  border-radius: var(--shadow-claw-radius-s, 8px);
  padding: 0.75rem;
  font-family: var(--mono);
  font-size: 0.78rem;
  height: 160px;
  overflow-y: auto;
}
.log-line {
  line-height: 1.4;
  margin-bottom: 0.2rem;
}
.log-tx { color: var(--accent, rgb(128 212 219)); }
.log-rx { color: var(--success, rgb(92 219 167)); }
.log-sys { color: var(--shadow-claw-text-secondary, rgb(177 203 206)); }
.log-err { color: var(--danger, rgb(255 180 171)); }

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  margin-top: 0.75rem;
}
.form-input {
  background: var(--shadow-claw-bg-primary, rgb(14 20 21));
  border: 1px solid var(--border);
  border-radius: var(--shadow-claw-radius-s, 6px);
  color: var(--shadow-claw-text-primary, #dde4e4);
  padding: 0.4rem 0.6rem;
  font-family: var(--mono);
  font-size: 0.85rem;
  flex: 1;
}

/* In-Component Fallback Guidance Modal */
dialog.guidance-dialog {
  background: var(--bg-card);
  color: var(--shadow-claw-text-primary, #dde4e4);
  border: 1px solid var(--border);
  border-radius: var(--shadow-claw-radius-m, 12px);
  padding: 1.5rem;
  max-width: 520px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.4);
}
dialog.guidance-dialog::backdrop {
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(2px);
}
.guidance-header {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 0.75rem;
}
.guidance-icon {
  font-size: 1.5rem;
}
.guidance-title {
  font-size: 1.2rem;
  font-weight: 700;
  margin: 0;
  color: var(--accent);
}
.guidance-msg {
  font-size: 0.9rem;
  color: var(--shadow-claw-text-secondary, #b1cbce);
  margin: 0 0 1rem 0;
  line-height: 1.5;
}
.guidance-box {
  background: var(--shadow-claw-bg-primary, rgb(14 20 21));
  border: 1px solid var(--border);
  border-radius: var(--shadow-claw-radius-s, 8px);
  padding: 0.85rem;
  margin-bottom: 1rem;
}
.guidance-box code {
  background: var(--bg-elevated);
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  border: 1px solid var(--border);
  font-family: var(--mono);
  color: var(--accent);
  user-select: all;
}
.guidance-links {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1.25rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border);
}
.guidance-link {
  color: var(--shadow-claw-link, var(--accent));
  text-decoration: none;
  font-size: 0.82rem;
  font-weight: 600;
}
.guidance-link:hover {
  text-decoration: underline;
  color: var(--accent-hover);
}
.guidance-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border);
}
`;

export class TinyduinoControlPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._onStateChange = this._onStateChange.bind(this);
    this._onPacket = this._onPacket.bind(this);
  }

  connectedCallback() {
    this.render();
    tinyduino.addEventListener("statechange", this._onStateChange);
    tinyduino.addEventListener("packet", this._onPacket);
    this._onStateChange();
  }

  disconnectedCallback() {
    tinyduino.removeEventListener("statechange", this._onStateChange);
    tinyduino.removeEventListener("packet", this._onPacket);
  }

  _onStateChange() {
    const s = tinyduino.getState();
    const shadow = this.shadowRoot;
    if (!shadow) return;

    // Badges & Buttons
    const badge = shadow.getElementById("status-badge");
    if (badge) {
      badge.className = `status-badge ${s.mode}`;
      badge.textContent =
        s.mode === "connected"
          ? `Connected (${s.deviceName})`
          : s.mode === "simulated"
            ? "Simulated Hardware"
            : "Disconnected";
    }

    const btnConnect = shadow.getElementById("btn-connect");
    const btnDisconnect = shadow.getElementById("btn-disconnect");
    const btnSim = shadow.getElementById("btn-sim");
    const btnStream = shadow.getElementById("btn-stream");

    if (btnConnect)
      btnConnect.disabled = s.mode === "connected" || s.mode === "simulated";
    if (btnDisconnect) btnDisconnect.disabled = s.mode === "disconnected";
    if (btnSim)
      btnSim.textContent =
        s.mode === "simulated" ? "Stop Simulation" : "Simulate Hardware";
    if (btnStream) {
      btnStream.textContent = s.streaming
        ? "Stop Live Stream"
        : "Start Live Stream";
      btnStream.className = s.streaming ? "btn btn-primary" : "btn";
    }

    // Gauge & KPI
    const gaugePct = shadow.getElementById("gauge-pct");
    const gaugeZone = shadow.getElementById("gauge-zone");
    const kpiAdc = shadow.getElementById("kpi-adc");
    const kpiVolts = shadow.getElementById("kpi-volts");
    const kpiLux = shadow.getElementById("kpi-lux");
    const kpiMinMax = shadow.getElementById("kpi-minmax");
    const auxLed = shadow.getElementById("aux-led");

    if (gaugePct)
      gaugePct.textContent = s.percent !== null ? `${s.percent}%` : "--%";
    if (gaugeZone) gaugeZone.textContent = s.category || "WAITING A0";
    if (kpiAdc) kpiAdc.textContent = s.rawA0 !== null ? s.rawA0 : "--";
    if (kpiVolts)
      kpiVolts.textContent =
        s.voltage !== null ? `${s.voltage.toFixed(2)} V` : "-- V";
    if (kpiLux) kpiLux.textContent = s.lux !== null ? `~${s.lux} lx` : "-- lx";
    const kpiLdr = shadow.getElementById("kpi-ldr");
    if (kpiLdr) {
      kpiLdr.textContent =
        s.ldrKohm !== undefined && s.ldrKohm !== null
          ? Number.isFinite(s.ldrKohm)
            ? `LDR ≈ ${s.ldrKohm} kΩ`
            : "LDR > 1 MΩ"
          : "Standard LDR curve";
    }
    const selPolarity = shadow.getElementById("sel-polarity");
    if (selPolarity && selPolarity.value !== s.polarity) {
      selPolarity.value = s.polarity;
    }
    if (kpiMinMax)
      kpiMinMax.textContent =
        s.minA0 !== null ? `${s.minA0} / ${s.maxA0}` : "-- / --";
    if (auxLed) auxLed.textContent = s.ledMode;

    this._drawWaveform(s.history);
  }

  _onPacket(e) {
    const logBox = this.shadowRoot.getElementById("packet-log");
    if (!logBox) return;
    const entry = e.detail;
    const div = document.createElement("div");
    div.className = `log-line log-${entry.direction.toLowerCase()}`;
    div.textContent = `${entry.timestamp} [${entry.direction}] ${entry.text}`;
    logBox.appendChild(div);
    logBox.scrollTop = logBox.scrollHeight;
  }

  _drawWaveform(history) {
    const canvas = this.shadowRoot.getElementById("waveform-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);
    if (!history || history.length < 2) return;

    const computedAccent =
      (typeof getComputedStyle === "function" &&
        getComputedStyle(this).getPropertyValue("--accent")?.trim()) ||
      "#80d4db";
    ctx.strokeStyle = computedAccent;
    ctx.lineWidth = 2;
    ctx.beginPath();

    const maxPoints = 60;
    const step = width / (maxPoints - 1);
    const startX = width - (history.length - 1) * step;

    for (let i = 0; i < history.length; i++) {
      const x = startX + i * step;
      // Map percent 0..100 to y (height..0)
      const pct = history[i].percent;
      const y = height - (pct / 100) * (height - 10) - 5;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>${STYLES}</style>
      
      <!-- Section 1: Hardware LightMeter Gauge & Waveform -->
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">☀️ Hardware LightMeter (S ➔ A0)</h2>
          <div class="toolbar">
            <button id="btn-read-light" class="btn btn-primary">Read Light Now</button>
            <button id="btn-stream" class="btn">Start Live Stream</button>
            <select id="sel-rate" class="btn">
              <option value="250">Rate: 250ms (4 Hz)</option>
              <option value="500" selected>Rate: 500ms (2 Hz)</option>
              <option value="1000">Rate: 1000ms (1 Hz)</option>
            </select>
          </div>
        </div>

        <div class="lightmeter-layout">
          <div class="gauge-box">
            <div id="gauge-pct" class="gauge-pct">--%</div>
            <div id="gauge-zone" class="gauge-zone">Waiting A0…</div>
          </div>

          <div>
            <div class="kpi-row">
              <div class="kpi-tile">
                <div class="kpi-label">Raw ADC (Pin A0)</div>
                <div id="kpi-adc" class="kpi-val">--</div>
                <div class="kpi-sub">10-bit (0–1023)</div>
              </div>
              <div class="kpi-tile">
                <div class="kpi-label">Signal Voltage</div>
                <div id="kpi-volts" class="kpi-val">-- V</div>
                <div class="kpi-sub">3.30V Reference</div>
              </div>
              <div class="kpi-tile">
                <div class="kpi-label">Est. Illuminance</div>
                <div id="kpi-lux" class="kpi-val">-- lx</div>
                <div id="kpi-ldr" class="kpi-sub">Standard LDR curve</div>
              </div>
              <div class="kpi-tile">
                <div class="kpi-label">Session Min / Max</div>
                <div id="kpi-minmax" class="kpi-val">-- / --</div>
                <div class="kpi-sub">Dynamic range</div>
              </div>
            </div>

            <div class="waveform-container">
              <canvas id="waveform-canvas" width="600" height="90" class="waveform"></canvas>
            </div>

            <div class="toolbar" style="margin-top: 0.5rem; justify-content: space-between;">
              <div>
                <label style="font-size: 0.75rem; color: var(--shadow-claw-text-tertiary, #899393); margin-right: 0.5rem;">Divider Polarity:</label>
                <select id="sel-polarity" class="btn">
                  <option value="high_adc_bright" selected>KY-018 Divider (High A0 = Bright)</option>
                  <option value="low_adc_bright">Inverted Pull-Up (Low A0 = Bright)</option>
                </select>
              </div>
              <div style="font-size: 0.75rem; color: var(--shadow-claw-text-tertiary, #899393);">
                LED Mode: <span id="aux-led" style="color: var(--accent); font-weight: bold;">AUTO</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Section 2: Transports & Controls -->
      <div class="grid-3">
        <!-- 1. BLE / Serial / Sim Transport -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">1. BLE / Serial / Sim Transport</h3>
            <span id="status-badge" class="status-badge disconnected">Disconnected</span>
          </div>
          <p style="font-size: 0.8rem; color: var(--shadow-claw-text-tertiary, #899393); margin-bottom: 1rem;">
            Web Bluetooth GATT (BGLib 195ae58a… Handle 17/20) with BlueZ 300ms CCCD settling delay.
            <span style="display: block; margin-top: 0.35rem;">
              <a href="main/troubleshooting/" target="_blank" style="color: var(--shadow-claw-link, var(--accent)); text-decoration: none;">📖 Linux Bluetooth &amp; chrome://flags Setup Guide ➔</a>
            </span>
          </p>
          <div class="toolbar">
            <button id="btn-connect" class="btn btn-primary">Connect Web Bluetooth</button>
            <button id="btn-disconnect" class="btn" disabled>Disconnect</button>
            <button id="btn-sim" class="btn">Simulate Hardware</button>
          </div>
        </div>

        <!-- 2. TinyDuino Controls -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">2. Hardware Controls</h3>
          </div>
          <div class="toolbar" style="margin-bottom: 0.75rem;">
            <button id="btn-led-on" class="btn">LED ON</button>
            <button id="btn-led-off" class="btn">LED OFF</button>
            <button id="btn-led-auto" class="btn">LED State Blink (Auto)</button>
            <button id="btn-status" class="btn">Read Status</button>
            <button id="btn-ping" class="btn">PING</button>
          </div>
          <form id="custom-form" class="toolbar">
            <input id="custom-input" class="form-input" placeholder="e.g. LIGHT, STATUS, LED_ON, RATE:500" />
            <button type="submit" class="btn">Send</button>
          </form>
        </div>
      </div>

      <!-- Section 3: GATT & BGAPI Packet Inspector -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">3. GATT & BGAPI Packet Inspector</h3>
          <button id="btn-clear-log" class="btn">Clear Log</button>
        </div>
        <div id="packet-log" class="packet-log"></div>
      </div>

      <!-- Fallback In-Component Guidance Dialog -->
      <dialog id="guidance-modal" class="guidance-dialog">
        <div class="guidance-content">
          <div class="guidance-header">
            <span class="guidance-icon">⚡</span>
            <h3 id="guidance-title" class="guidance-title">Web Bluetooth Setup Required</h3>
          </div>
          <p id="guidance-msg" class="guidance-msg">
            Web Bluetooth is disabled by default on Linux Chrome. Enable the experimental flag or switch to simulated hardware.
          </p>
          <div class="guidance-box">
            <div style="font-weight: 600; font-size: 0.8rem; margin-bottom: 0.4rem; color: var(--accent);">Linux Chrome Setup:</div>
            <ol style="margin: 0; padding-left: 1.25rem; font-size: 0.8rem; line-height: 1.6; color: var(--shadow-claw-text-secondary, #b1cbce);">
              <li>Open a new tab and paste: <code>chrome://flags/#enable-web-bluetooth</code></li>
              <li>Set <strong>Web Bluetooth</strong> to <strong>Enabled</strong>.</li>
              <li>Relaunch Chrome to activate hardware Bluetooth.</li>
            </ol>
          </div>
          <div class="guidance-links">
            <a href="main/troubleshooting/" target="_blank" class="guidance-link">📖 Hardware Troubleshooting Guide</a>
            <a href="https://github.com/WebBluetoothCG/web-bluetooth/blob/main/implementation-status.md" target="_blank" class="guidance-link">🌐 Web Bluetooth Linux Support</a>
          </div>
          <div class="guidance-actions">
            <button id="btn-guidance-sim" class="btn btn-primary">Simulate Hardware Instead</button>
            <button id="btn-guidance-close" class="btn">Close</button>
          </div>
        </div>
      </dialog>
    `;

    this._bindEvents();
  }

  async showGuidanceDialog(err) {
    if (
      err &&
      (err.name === "NotFoundError" || err.message?.includes("User cancelled"))
    ) {
      tinyduino.logPacket(
        "SYS",
        "Web Bluetooth device pairing cancelled by user.",
      );
      return;
    }

    const isLinux =
      typeof navigator !== "undefined" && /Linux/i.test(navigator.userAgent);
    const isChrome =
      typeof navigator !== "undefined" &&
      /Chrome|Chromium/i.test(navigator.userAgent);
    const isUnsupported =
      !navigator.bluetooth ||
      err?.name === "BluetoothUnsupportedError" ||
      err?.message?.includes("not supported");

    const appShell = document.querySelector("shadow-claw");
    if (appShell && typeof appShell.requestDialog === "function") {
      const title = isUnsupported
        ? "Web Bluetooth Setup Required"
        : "Bluetooth Connection Notice";
      const message = isUnsupported
        ? isLinux && isChrome
          ? "Web Bluetooth on Linux Chrome requires enabling an experimental feature flag in chrome://flags."
          : "Web Bluetooth is currently unavailable or disabled in this browser."
        : err?.message ||
          "Failed to communicate with TinyDuino Bluetooth device.";

      const details = isUnsupported
        ? [
            "On Linux Chrome, Web Bluetooth is behind an experimental flag and disabled by default.",
            "1. In a new tab, navigate to: chrome://flags",
            "2. Search for 'Web Bluetooth' (#enable-web-bluetooth) and set it to 'Enabled'.",
            "3. Relaunch Google Chrome to apply the setting.",
            "Tip: You can click 'Simulate Hardware' on the workbench to test immediately without physical Bluetooth.",
          ]
        : [
            "Ensure your TinyDuino hardware stack is powered on with shadow-claw-light-meter.ino running.",
            "If using Linux BlueZ, cycle your Bluetooth adapter if the GATT service cache is stale.",
            "Ensure the TinyShield BLE112 (ASD2112) is within range.",
          ];

      const links = [
        {
          label: "Hardware Troubleshooting Guide",
          href: "main/troubleshooting/",
        },
        {
          label: "Web Bluetooth Linux Support Status",
          href: "https://github.com/WebBluetoothCG/web-bluetooth/blob/main/implementation-status.md",
        },
      ];

      await appShell.requestDialog({
        title,
        message,
        mode: "info",
        confirmLabel: "Understood",
        details,
        links,
      });
      return;
    }

    // In-component fallback modal
    const modal = this.shadowRoot.getElementById("guidance-modal");
    if (modal && typeof modal.showModal === "function") {
      const titleEl = this.shadowRoot.getElementById("guidance-title");
      const msgEl = this.shadowRoot.getElementById("guidance-msg");
      if (titleEl)
        titleEl.textContent = isUnsupported
          ? "Web Bluetooth Setup Required"
          : "Bluetooth Connection Notice";
      if (msgEl) {
        msgEl.textContent = isUnsupported
          ? "Web Bluetooth is disabled by default on Linux Chrome. Enable the experimental flag or switch to simulated hardware."
          : err?.message || "Failed to connect to Bluetooth device.";
      }
      modal.showModal();
    }
  }

  _bindEvents() {
    const shadow = this.shadowRoot;
    shadow
      .getElementById("btn-connect")
      ?.addEventListener("click", () =>
        tinyduino.connectBle().catch((err) => this.showGuidanceDialog(err)),
      );
    shadow
      .getElementById("btn-guidance-close")
      ?.addEventListener("click", () => {
        shadow.getElementById("guidance-modal")?.close();
      });
    shadow.getElementById("btn-guidance-sim")?.addEventListener("click", () => {
      shadow.getElementById("guidance-modal")?.close();
      tinyduino.toggleSimulation(true);
    });
    shadow
      .getElementById("btn-disconnect")
      ?.addEventListener("click", () => tinyduino.disconnect());
    shadow.getElementById("btn-sim")?.addEventListener("click", () => {
      const s = tinyduino.getState();
      tinyduino.toggleSimulation(s.mode !== "simulated");
    });
    shadow
      .getElementById("btn-read-light")
      ?.addEventListener("click", () =>
        tinyduino
          .sendCommand("read_light")
          .catch((err) => this.showGuidanceDialog(err)),
      );
    shadow.getElementById("btn-stream")?.addEventListener("click", async () => {
      const s = tinyduino.getState();
      try {
        if (s.streaming) {
          await tinyduino.sendCommand("stop_stream");
        } else {
          const rate = Number(shadow.getElementById("sel-rate")?.value) || 500;
          await tinyduino.sendCommand("stream_light", { rateMs: rate });
        }
      } catch (err) {
        this.showGuidanceDialog(err);
      }
    });
    shadow.getElementById("sel-rate")?.addEventListener("change", (e) => {
      const rate = Number(e.target.value) || 500;
      tinyduino.streamRateMs = rate;
      if (tinyduino.getState().mode !== "disconnected") {
        tinyduino
          .sendRawText(`RATE:${rate}`)
          .catch((err) => this.showGuidanceDialog(err));
      }
    });
    shadow
      .getElementById("sel-polarity")
      ?.addEventListener("change", (e) =>
        tinyduino.setPolarity(e.target.value),
      );
    shadow
      .getElementById("btn-led-on")
      ?.addEventListener("click", () =>
        tinyduino
          .sendCommand("set_led", { state: "ON" })
          .catch((err) => this.showGuidanceDialog(err)),
      );
    shadow
      .getElementById("btn-led-off")
      ?.addEventListener("click", () =>
        tinyduino
          .sendCommand("set_led", { state: "OFF" })
          .catch((err) => this.showGuidanceDialog(err)),
      );
    shadow
      .getElementById("btn-led-auto")
      ?.addEventListener("click", () =>
        tinyduino
          .sendCommand("set_led", { state: "AUTO" })
          .catch((err) => this.showGuidanceDialog(err)),
      );
    shadow
      .getElementById("btn-status")
      ?.addEventListener("click", () =>
        tinyduino
          .sendCommand("get_status")
          .catch((err) => this.showGuidanceDialog(err)),
      );
    shadow
      .getElementById("btn-ping")
      ?.addEventListener("click", () =>
        tinyduino
          .sendCommand("ping")
          .catch((err) => this.showGuidanceDialog(err)),
      );
    shadow.getElementById("btn-clear-log")?.addEventListener("click", () => {
      const log = shadow.getElementById("packet-log");
      if (log) log.innerHTML = "";
    });
    shadow.getElementById("custom-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = shadow.getElementById("custom-input");
      const text = input.value.trim();
      if (!text) return;
      tinyduino
        .sendRawText(text + "\n")
        .catch((err) => this.showGuidanceDialog(err));
      input.value = "";
    });
  }
}

if (!customElements.get("tinyduino-control-panel")) {
  customElements.define("tinyduino-control-panel", TinyduinoControlPanel);
}
