import type { BridgeStatus } from "./status.ts";
import { qrSvg } from "./qr.ts";

export interface HostPageInput {
  joinCode: string;
  urls: string[];
  status: BridgeStatus;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

/**
 * Operator page. The caller must serve this only to loopback.
 * The QR encodes the LAN URL. It does not encode the join code.
 */
export function renderHostPage(input: HostPageInput): string {
  const urls = input.urls;
  const cards =
    urls.length === 0
      ? `<section class="warn">
          <h2>No LAN address</h2>
          <p>This PC has no Wi-Fi or Ethernet IPv4 address. A phone cannot open the controller until this computer is on the same network as the PlayStation.</p>
          <ol>
            <li>Join the same Wi-Fi as the console. Avoid guest networks and client isolation.</li>
            <li>Close this window and start the bridge again.</li>
            <li>If the console is asleep, wake it and type its IP on the phone. Settings, Network, View Connection Status.</li>
          </ol>
        </section>`
      : urls
          .map((url) => {
            const safe = escapeHtml(url);
            return `<section class="card">
              <h2>Phone URL</h2>
              <p class="url">${safe}</p>
              <div class="qr">${qrSvg(url)}</div>
              <p>Scan with the phone camera. The page opens in Safari or Chrome. Then type the join code.</p>
            </section>`;
          })
          .join("\n");

  const bound = input.status.playlink.bound;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Knowledge Is Power bridge</title>
  <style>
    body { margin: 0; font-family: Segoe UI, sans-serif; background: #07141f; color: #e7f6f8; }
    main { max-width: 720px; margin: 0 auto; padding: 28px 20px 48px; }
    h1 { font-size: 1.8rem; margin: 0 0 8px; }
    .code { font-family: Consolas, monospace; font-size: 2.4rem; letter-spacing: 0.18em; background: #10283a; display: inline-block; padding: 8px 14px; }
    .card, .warn { border: 1px solid #1d4e63; background: #0c1e2c; padding: 16px; margin-top: 16px; }
    .warn { border-color: #a16207; }
    .url { font-family: Consolas, monospace; font-size: 1.1rem; word-break: break-all; }
    .qr svg { width: min(280px, 80vw); height: auto; background: #fff; }
    .qr svg rect { fill: #000; }
    ol { padding-left: 1.2rem; }
    #state { margin-top: 12px; }
  </style>
</head>
<body>
  <main>
    <p>Knowledge Is Power</p>
    <h1>Bridge on this PC</h1>
    <p>Type this join code on the phone. It is not inside the QR code, and it is not sent to other computers.</p>
    <p class="code">${escapeHtml(input.joinCode)}</p>
    ${cards}
    <section class="card" id="state">
      <h2>Connection</h2>
      <p id="udp">${bound ? "A phone has joined. UDP 9060 is open toward the console." : "UDP 9060 is closed until a phone joins with this code."}</p>
      <p id="sessions">${input.status.sessions.active} player session(s). ${input.status.sessions.free} of ${input.status.sessions.endpoints} host address(es) still free.</p>
      <p id="playable">PlayLink addresses: ${(input.status.sessions.playable ?? []).join(", ") || "(none)"}</p>
      <p>One host IPv4 address can carry one browser player. A second phone needs a second address on this PC (see docs/multiplayer.md). This program will not change Windows network settings without your consent.</p>
      <p>If Discover finds nothing, type the PlayStation IP on the phone. Real console play is still unverified until you try it on your own PS4 or PS5.</p>
      <p>Press Wyłącz (Stop) in the bridge app, or close that window, to stop. Allow the app on private networks if Windows Firewall asks (TCP 8787, and UDP 9060 after a join).</p>
    </section>
    <section class="card" id="updates">
      <h2>Updates</h2>
      <p>Version <span id="appVersion">…</span></p>
      <p id="updateStatus">Checking is optional. Updates never download until you press Update Now.</p>
      <p id="updateDetail"></p>
      <div id="updateActions" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
        <button type="button" id="checkUpdates">Check for Updates</button>
        <button type="button" id="updateNow" hidden>Update Now</button>
        <button type="button" id="updateLater" hidden>Later</button>
        <button type="button" id="installUpdate" hidden>Install &amp; Restart</button>
      </div>
      <progress id="updateProgress" max="100" value="0" hidden style="width:100%;margin-top:8px"></progress>
    </section>
  </main>
  <script>
    async function tick() {
      const response = await fetch("/api/status", { cache: "no-store" });
      const body = await response.json();
      document.getElementById("udp").textContent = body.playlink.bound
        ? "A phone has joined. UDP 9060 is open toward the console."
        : "UDP 9060 is closed until a phone joins with the code on this page.";
      document.getElementById("sessions").textContent =
        body.sessions.active + " player session(s). " + body.sessions.free + " of " + body.sessions.endpoints + " host address(es) still free.";
      document.getElementById("playable").textContent =
        "PlayLink addresses: " + ((body.sessions.playable && body.sessions.playable.length) ? body.sessions.playable.join(", ") : "(none)");
      if (body.update) renderUpdate(body.update);
    }
    function renderUpdate(update) {
      document.getElementById("appVersion").textContent = update.currentVersion || "unknown";
      const status = document.getElementById("updateStatus");
      const detail = document.getElementById("updateDetail");
      const updateNow = document.getElementById("updateNow");
      const updateLater = document.getElementById("updateLater");
      const installUpdate = document.getElementById("installUpdate");
      const progress = document.getElementById("updateProgress");
      updateNow.hidden = true;
      updateLater.hidden = true;
      installUpdate.hidden = true;
      progress.hidden = true;
      if (update.state === "available") {
        status.textContent = "KIP-Bridge Update Available";
        detail.textContent = "Current version: " + update.currentVersion + " — New version: " + update.availableVersion + (update.releaseNotes ? " — " + update.releaseNotes : "");
        updateNow.hidden = false;
        updateLater.hidden = false;
      } else if (update.state === "downloading") {
        status.textContent = "Downloading update…";
        detail.textContent = update.availableVersion || "";
        progress.hidden = false;
        progress.value = update.progressPercent || 0;
      } else if (update.state === "ready") {
        status.textContent = update.sessionsActive
          ? "Update downloaded. Waiting until no PlayLink session is active."
          : "Update verified. Install when ready.";
        detail.textContent = update.availableVersion || "";
        installUpdate.hidden = !!update.sessionsActive;
      } else if (update.state === "error") {
        status.textContent = "Update check failed";
        detail.textContent = update.error || "unknown error";
      } else if (update.state === "up_to_date") {
        status.textContent = "Up to date";
        detail.textContent = "";
      } else {
        status.textContent = "Updates never download until you press Update Now.";
        detail.textContent = update.error || "";
      }
    }
    document.getElementById("checkUpdates").onclick = async () => {
      await fetch("/api/update/check", { method: "POST" });
      await tick();
    };
    document.getElementById("updateNow").onclick = async () => {
      await fetch("/api/update/download", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: true }) });
      await tick();
    };
    document.getElementById("updateLater").onclick = async () => {
      await fetch("/api/update/later", { method: "POST" });
      await tick();
    };
    document.getElementById("installUpdate").onclick = async () => {
      await fetch("/api/update/install", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: true }) });
      await tick();
    };
    setInterval(tick, 2000);
    tick();
  </script>
</body>
</html>`;
}
