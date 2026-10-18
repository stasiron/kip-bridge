import type { AddressInfo } from "node:net";
import { lanIpv4Addresses } from "./playlink/pool.ts";
import { qrAscii } from "./qr.ts";
import type { BridgeHandle } from "./server.ts";

function lanHttpUrls(port: number): string[] {
  return lanIpv4Addresses().map((address) => `http://${address}:${port}/`);
}

export function explainListenError(error: NodeJS.ErrnoException, port: number): string {
  if (error.code === "EADDRINUSE") {
    return `Port ${port} is already in use. Close the other Knowledge Is Power bridge window, then start this one again.`;
  }
  if (error.code === "EADDRNOTAVAIL" || error.code === "EACCES") {
    return `The bridge could not listen on port ${port} (${error.code}). Connect this PC to Wi-Fi and start again. Windows network settings were not changed.`;
  }
  return `The bridge could not listen on port ${port}: ${error.message}`;
}

export function listenBridge(bridge: BridgeHandle, host: string, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (error: NodeJS.ErrnoException) => {
      bridge.server.off("error", onError);
      reject(error);
    };
    bridge.server.once("error", onError);
    bridge.server.listen(port, host, () => {
      bridge.server.off("error", onError);
      resolve();
    });
  });
}

export function printStartupBanner(bridge: BridgeHandle, port: number): void {
  const urls = lanHttpUrls(port);
  console.log("");
  console.log("Knowledge Is Power bridge");
  console.log(`Join code: ${bridge.joinCode}`);
  console.log("");
  console.log(`On this PC, open http://127.0.0.1:${port}/host`);
  console.log("The join code stays on this PC. The QR code contains only the phone URL.");
  console.log("UDP 9060 stays closed until a phone joins with that code.");
  console.log("");
  if (urls.length === 0) {
    console.log("No LAN IPv4 address. A phone cannot connect yet.");
    console.log("Join the same Wi-Fi as the PlayStation, then start the bridge again.");
    console.log("Guest Wi-Fi and client isolation hide this PC from the phone.");
  } else {
    if (urls.length > 1) {
      console.log(`${urls.length} LAN addresses. Each one can carry one browser player.`);
      console.log("This program will not add or remove Windows addresses.");
    }
    for (const url of urls) {
      console.log(url);
      console.log(qrAscii(url));
      console.log("");
    }
  }
  console.log("If the phone cannot find the console, type the PlayStation IP.");
  console.log("PlayStation compatibility is unverified until you test on your own console.");
  console.log("Close this window to stop the bridge.");
  console.log("");
}

export async function runBridge(bridge: BridgeHandle, host: string, port: number): Promise<void> {
  try {
    await listenBridge(bridge, host, port);
  } catch (error) {
    const errno = error as NodeJS.ErrnoException;
    console.error(explainListenError(errno, port));
    process.exitCode = 1;
    return;
  }
  const address = bridge.server.address() as AddressInfo;
  printStartupBanner(bridge, address.port);
  let closing = false;
  const shutdown = (label: string) => {
    if (closing) return;
    closing = true;
    console.log(`${label}: closing the bridge and releasing UDP 9060.`);
    void bridge.close().then(
      () => process.exit(0),
      (error: unknown) => {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      },
    );
  };
  process.on("SIGINT", () => shutdown("Ctrl+C"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}
