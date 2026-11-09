import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SHADOW_CLAW_LOBSTER_HASHES = new Set([
  "33a5914fdb9b42c622ceb4bdfd421d7c8792ce3809a10acc83dd356a975c1f66", // 48.png
  "a48ba6e50b2f8c54ee08480cb131365372757e9677e71fb09996395e3dacc086", // 72.png
  "1c7002983e6a36a309914466acf7aa98044b95e7fb940c17a03189638aa54a1d", // 96.png
  "4c1f774f8df852836dfbac0ac9400f0ae9fe9d3f340379f7588dbfee599c8e59", // 128.png
  "7d8bb2f52284861d86f389820f887c9b804e15f347cc3b38777612abc3c37e1f", // 152.png
  "9898621a296cc836d79a2b8881fe126bd73823eb53a8fbabbb9a0761e0280cc4", // 180.png
  "46fe87f35e8d62257eda46149045bad8edd8e382d22f0df92a4a635e0286e8a0", // 192.png
  "02c2881dbb68aa86e5e499c38c893386c1af4f048d557438987b7c2e7286eace", // 512.png
  "423e9e930bd88b9e7f28087b1a1a26e55f6c75426996d10172596e939833f5f2", // 1024.png
  "035f49ba449226300ac237220e8a5ed0472ea77885dee63a978f3db35128adda", // favicon.ico
  "8aa7e215fa7ebe34bb5a12f1842f75caa365659733c460caa42d038afe25911b", // shadow-claw-screenshot-1920x1052.png
  "7997952cc418887610d1d24d3306805ccf028d9b6f73740d456042eb0592f5e9", // shadow-claw-screenshot-731x1045.png
]);

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const ROUTES_PATH = resolve(ROOT, "pages/resources/routes.json");

test("Pages: all routes mapped in routes.json exist and have valid metadata", () => {
  assert.ok(existsSync(ROUTES_PATH), "routes.json must exist");
  const routesData = JSON.parse(readFileSync(ROUTES_PATH, "utf8"));
  assert.ok(routesData.routes);

  for (const [routeFile, routeMeta] of Object.entries(routesData.routes)) {
    const fullPath = resolve(ROOT, routeFile.replace(/^\//, ""));
    assert.ok(
      existsSync(fullPath),
      `Target page file must exist: ${routeFile}`,
    );

    const content = readFileSync(fullPath, "utf8");
    assert.ok(
      content.startsWith("---"),
      `Page ${routeFile} must contain YAML frontmatter`,
    );
    assert.ok(
      routeMeta.prettyPath,
      `Route ${routeFile} must have a prettyPath`,
    );
  }
});

test("PWA Manifest: start_url and share_target.action are within manifest scope", () => {
  const manifestPath = resolve(ROOT, "pages/resources/manifest.json");
  assert.ok(existsSync(manifestPath), "manifest.json must exist");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

  assert.equal(
    manifest.start_url,
    ".",
    "start_url must be '.' so root scope covers all routes",
  );
  assert.equal(
    manifest.scope,
    ".",
    "scope must be '.' so share_target.action is inside manifest scope",
  );
  if (manifest.share_target?.action) {
    assert.ok(
      !manifest.share_target.action.startsWith(".."),
      "share_target.action must be within manifest root scope",
    );
  }
});

test("Workbench scripts: shadow-claw.config.json and built HTML inject tinyduino custom element scripts", () => {
  const configPath = resolve(ROOT, "shadow-claw.config.json");
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  const scripts = config.customElements?.scripts || [];

  const elementScript = scripts.find((s) =>
    s.src?.includes("tinyduino-element.js"),
  );
  const adapterScript = scripts.find((s) =>
    s.src?.includes("tinyduino-adapter.js"),
  );

  assert.ok(
    elementScript,
    "tinyduino-element.js must be in customElements.scripts",
  );
  assert.equal(
    elementScript.global,
    true,
    "tinyduino-element.js must set global: true so DSD & client pages always upgrade <tinyduino-control-panel>",
  );
  assert.equal(
    elementScript.autoload,
    true,
    "tinyduino-element.js must set autoload: true",
  );

  assert.ok(
    adapterScript,
    "tinyduino-adapter.js must be in customElements.scripts",
  );
  assert.equal(
    adapterScript.global,
    true,
    "tinyduino-adapter.js must set global: true",
  );
  assert.equal(
    adapterScript.autoload,
    true,
    "tinyduino-adapter.js must set autoload: true",
  );

  assert.equal(
    config.theme?.stylesheet,
    "pages/main/theme.css",
    "theme.stylesheet must be configured to pages/main/theme.css",
  );
  assert.ok(
    existsSync(resolve(ROOT, "pages/main/theme.css")),
    "pages/main/theme.css must exist",
  );
  assert.equal(
    config.settings?.assistantName,
    "Lux",
    "assistantName must be Lux",
  );

  const workbenchHtml = readFileSync(
    resolve(ROOT, "pages/main/tinyduino.html"),
    "utf8",
  );
  assert.ok(
    workbenchHtml.includes(
      "<tinyduino-control-panel></tinyduino-control-panel>",
    ),
    "pages/main/tinyduino.html must contain <tinyduino-control-panel>",
  );
  assert.ok(
    workbenchHtml.includes("tinyduino-element"),
    "pages/main/tinyduino.html frontmatter must declare tinyduino-element script dependency",
  );

  const builtWorkbenchPath = resolve(
    ROOT,
    "dist/public/main/tinyduino/index.html",
  );
  if (existsSync(builtWorkbenchPath)) {
    const builtHtml = readFileSync(builtWorkbenchPath, "utf8");
    assert.ok(
      builtHtml.includes("/.agents/scripts/tinyduino-element.js"),
      "built dist/public/main/tinyduino/index.html must inject /.agents/scripts/tinyduino-element.js",
    );
    assert.ok(
      builtHtml.includes("/.agents/scripts/tinyduino-adapter.js"),
      "built dist/public/main/tinyduino/index.html must inject /.agents/scripts/tinyduino-adapter.js",
    );
  }
});

test("Theme: pages/main/theme.css and workbench use Material Theme Builder tokens", () => {
  const themeCss = readFileSync(resolve(ROOT, "pages/main/theme.css"), "utf8");

  // Material 3 design tokens from Material Theme Builder export
  assert.ok(
    themeCss.includes("--md-sys-color-primary: rgb(128 212 219)"),
    "Must define M3 primary photon cyan",
  );
  assert.ok(
    themeCss.includes("--md-sys-color-background: rgb(14 20 21)"),
    "Must define M3 dark background obsidian",
  );
  assert.ok(
    themeCss.includes("--md-sys-color-surface-container: rgb(26 33 33)"),
    "Must define M3 dark surface container",
  );
  assert.ok(
    themeCss.includes(
      "--shadow-claw-accent-primary: var(--md-sys-color-primary",
    ),
    "Must map --shadow-claw-accent-primary to M3 primary",
  );
  assert.ok(
    themeCss.includes(
      "--shadow-claw-bg-primary: var(--md-sys-color-background",
    ),
    "Must map --shadow-claw-bg-primary to M3 background",
  );

  // Custom element styling must use CSS custom properties rather than hardcoded navy / amber
  const elementJs = readFileSync(
    resolve(ROOT, ".agents/scripts/tinyduino-element.js"),
    "utf8",
  );
  assert.ok(
    !elementJs.includes("--accent: #f59e0b;"),
    "tinyduino-element.js must not hardcode old yellow --accent: #f59e0b",
  );
  assert.ok(
    !elementJs.includes("--bg-card: #131c31;"),
    "tinyduino-element.js must not hardcode old navy --bg-card: #131c31",
  );
  assert.ok(
    elementJs.includes("var(--shadow-claw-accent-primary"),
    "tinyduino-element.js must bind to theme accent",
  );
});

test("Release readiness: no internal/unreleased terminology (V2, Review 1/2, RFC v0.2.0, shadow-claw-control-hub) in docs or firmware", () => {
  const firmwarePath = resolve(
    ROOT,
    "firmware/shadow-claw-light-meter/shadow-claw-light-meter.ino",
  );
  assert.ok(existsSync(firmwarePath), "firmware sketch must exist");
  const firmwareIno = readFileSync(firmwarePath, "utf8");
  assert.ok(
    !firmwareIno.includes("V2"),
    "shadow-claw-light-meter.ino must not contain 'V2'",
  );
  assert.ok(
    !firmwareIno.includes("Review 2"),
    "shadow-claw-light-meter.ino must not contain 'Review 2'",
  );

  const indexHtml = readFileSync(
    resolve(ROOT, "pages/main/index.html"),
    "utf8",
  );
  assert.ok(!indexHtml.includes("V2"), "index.html must not contain 'V2'");
  assert.ok(!indexHtml.includes("v0.2"), "index.html must not contain 'v0.2'");
  assert.ok(
    !indexHtml.includes("control-hub"),
    "index.html must not contain unreleased 'control-hub'",
  );

  const readme = readFileSync(resolve(ROOT, "README.md"), "utf8");
  assert.ok(!readme.includes("V2"), "README.md must not contain 'V2'");
  assert.ok(
    !readme.includes("RFC v0.2.0"),
    "README.md must not contain 'RFC v0.2.0'",
  );
  assert.ok(
    !readme.includes("control-hub"),
    "README.md must not contain unreleased 'control-hub'",
  );
  assert.ok(
    !readme.includes("Control Hub"),
    "README.md must not contain unreleased 'Control Hub'",
  );

  const agentsMd = readFileSync(resolve(ROOT, "AGENTS.md"), "utf8");
  assert.ok(
    !agentsMd.includes("control-hub"),
    "AGENTS.md must not contain unreleased 'control-hub'",
  );

  const daylightHarvest = readFileSync(
    resolve(ROOT, ".agents/skills/daylight-harvest/SKILL.md"),
    "utf8",
  );
  assert.ok(
    !daylightHarvest.includes("control-hub"),
    "daylight-harvest skill must not contain unreleased 'control-hub'",
  );

  const config = JSON.parse(
    readFileSync(resolve(ROOT, "shadow-claw.config.json"), "utf8"),
  );
  assert.equal(
    config.branding?.siteUrl,
    "https://xt-ml.github.io/shadow-claw-light-meter/",
    "branding.siteUrl must match official xt-ml GitHub Pages URL",
  );
  assert.equal(
    config.branding?.repoUrl,
    "https://github.com/xt-ml/shadow-claw-light-meter",
    "branding.repoUrl must match official xt-ml GitHub repo URL",
  );
  assert.ok(
    !readme.includes("kherrick.github.io"),
    "README.md must use official xt-ml URL",
  );

  const pkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8"));
  assert.equal(
    pkg.homepage,
    "https://xt-ml.github.io/shadow-claw-light-meter/",
    "package.json homepage must match official xt-ml URL",
  );
  assert.equal(
    pkg.repository?.url,
    "git+https://github.com/xt-ml/shadow-claw-light-meter.git",
    "package.json repository must match official xt-ml git URL",
  );
});

test("Markdown typography: no unrendered LaTeX or MathML tags across documentation and MEMORY.md", () => {
  const filesToCheck = [
    "pages/main/MEMORY.md",
    "pages/main/~/content/01-hardware-architecture.md",
    "pages/main/~/content/02-wiring-schematic.md",
    "pages/main/~/content/04-ky018-calibration.md",
    "pages/main/~/content/06-divider-math.md",
    "pages/main/~/content/08-firmware-guide.md",
    "pages/main/~/content/11-workbench-ui.md",
    "pages/main/~/content/12-namespace-isolation.md",
    "README.md",
    ".agents/skills/tinyduino-doctor/SKILL.md",
    ".agents/skills/dusk-trigger/SKILL.md",
    ".agents/skills/daylight-harvest/SKILL.md",
  ];

  for (const relPath of filesToCheck) {
    const fullPath = resolve(ROOT, relPath);
    const content = readFileSync(fullPath, "utf8");

    assert.ok(
      !content.includes("$$"),
      `${relPath} must not contain raw '$$' LaTeX math delimiters`,
    );
    assert.ok(
      !content.includes("<math"),
      `${relPath} must not contain unrendered '<math' MathML tags`,
    );
    assert.ok(
      !content.includes("\\frac"),
      `${relPath} must not contain raw '\\frac' LaTeX syntax`,
    );
    assert.ok(
      !content.includes("\\text{"),
      `${relPath} must not contain raw '\\text{' LaTeX syntax`,
    );
  }

  // MEMORY.md must serve as a comprehensive agent briefing with links to skills and guides
  const memoryContent = readFileSync(
    resolve(ROOT, "pages/main/MEMORY.md"),
    "utf8",
  );
  assert.ok(
    memoryContent.includes("/main/tinyduino/"),
    "MEMORY.md must link to interactive workbench",
  );
  assert.ok(
    memoryContent.includes("/lightmeter"),
    "MEMORY.md must document /lightmeter skill",
  );
  assert.ok(
    memoryContent.includes("/nightlight"),
    "MEMORY.md must document /nightlight skill",
  );
  assert.ok(
    memoryContent.includes("/tinyduino-doctor"),
    "MEMORY.md must document /tinyduino-doctor skill",
  );
  assert.ok(
    memoryContent.includes("tinyduino_read_light"),
    "MEMORY.md must list primary agent tools",
  );
});

test("Internal links: documentation pages and workbench must use base-path compatible relative paths instead of domain-root '/main/'", () => {
  const contentDir = resolve(ROOT, "pages/main/~/content");
  const markdownFiles = [
    "01-hardware-architecture.md",
    "02-wiring-schematic.md",
    "03-ble112-bgapi.md",
    "04-ky018-calibration.md",
    "05-field-diagnostics.md",
    "06-divider-math.md",
    "07-wokwi-simulation.md",
    "08-firmware-guide.md",
    "09-webmcp-tools.md",
    "10-agent-skills.md",
    "11-workbench-ui.md",
    "12-namespace-isolation.md",
    "13-troubleshooting.md",
    "14-download-center.md",
  ];

  for (const file of markdownFiles) {
    const fullPath = resolve(contentDir, file);
    const content = readFileSync(fullPath, "utf8");
    assert.ok(
      !content.includes("](/main/"),
      `${file} must not contain domain-root '](/main/' links which 404 on GitHub Pages; use relative '](main/' or '](../'`,
    );
    assert.ok(
      !content.includes('href="/main/'),
      `${file} must not contain 'href="/main/' links which 404 on GitHub Pages`,
    );
  }

  const indexHtml = readFileSync(
    resolve(ROOT, "pages/main/index.html"),
    "utf8",
  );
  assert.ok(
    !indexHtml.includes('href="/main/'),
    "pages/main/index.html must not contain domain-root 'href=\"/main/' links; use 'href=\"main/' to support base-path",
  );

  const tinyduinoHtml = readFileSync(
    resolve(ROOT, "pages/main/tinyduino.html"),
    "utf8",
  );
  assert.ok(
    !tinyduinoHtml.includes('href="/main/'),
    "pages/main/tinyduino.html must not contain domain-root 'href=\"/main/' links; use 'href=\"main/' to support base-path",
  );

  const elementJs = readFileSync(
    resolve(ROOT, ".agents/scripts/tinyduino-element.js"),
    "utf8",
  );
  assert.ok(
    !elementJs.includes('href="/main/'),
    "tinyduino-element.js must not contain hardcoded 'href=\"/main/' links; use 'href=\"main/'",
  );
  assert.ok(
    !elementJs.includes('href: "/main/'),
    "tinyduino-element.js dialog links must not use domain-root 'href: \"/main/'",
  );
});

test("Iconography & PWA Manifest: all icons and screenshots are template-specific (no ShadowClaw lobster defaults) and appleTouchIconPath points to raster PNG", () => {
  const config = JSON.parse(
    readFileSync(resolve(ROOT, "shadow-claw.config.json"), "utf8"),
  );
  assert.equal(
    config.branding?.faviconPath,
    "assets/icons/favicon.svg",
    "faviconPath must be assets/icons/favicon.svg",
  );
  assert.equal(
    config.branding?.appleTouchIconPath,
    "assets/icons/180.png",
    "appleTouchIconPath must point to raster PNG (assets/icons/180.png) for iOS Home Screen support",
  );

  const manifest = JSON.parse(
    readFileSync(resolve(ROOT, "pages/resources/manifest.json"), "utf8"),
  );
  assert.notEqual(manifest.id, "shadow-claw");
  const iconSrcs = (manifest.icons || []).map((i) => i.src);
  assert.ok(
    iconSrcs.includes("assets/icons/favicon.svg"),
    "manifest.icons must include assets/icons/favicon.svg",
  );
  assert.ok(
    iconSrcs.includes("assets/icons/180.png"),
    "manifest.icons must include assets/icons/180.png",
  );

  const requiredIcons = [
    "favicon.svg",
    "favicon.ico",
    "apple-touch-icon.png",
    "48.png",
    "72.png",
    "96.png",
    "128.png",
    "152.png",
    "180.png",
    "192.png",
    "512.png",
    "1024.png",
  ];
  for (const file of requiredIcons) {
    const iconPath = resolve(ROOT, "pages/resources/assets/icons", file);
    assert.ok(existsSync(iconPath), `Missing icon file: ${file}`);
    const hash = createHash("sha256")
      .update(readFileSync(iconPath))
      .digest("hex");
    assert.equal(
      SHADOW_CLAW_LOBSTER_HASHES.has(hash),
      false,
      `Icon ${file} must be template-specific and not match ShadowClaw default red lobster icon`,
    );
  }

  for (const screen of manifest.screenshots || []) {
    const screenPath = resolve(ROOT, "pages/resources", screen.src);
    assert.ok(
      existsSync(screenPath),
      `Missing manifest screenshot: ${screen.src}`,
    );
    const hash = createHash("sha256")
      .update(readFileSync(screenPath))
      .digest("hex");
    assert.equal(
      SHADOW_CLAW_LOBSTER_HASHES.has(hash),
      false,
      `Screenshot ${screen.src} must be template-specific and not match ShadowClaw default screenshot`,
    );
  }
});
