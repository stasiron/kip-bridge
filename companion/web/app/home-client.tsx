"use client";

import { useEffect, useState } from "react";
import { ControllerApp } from "./controller/controller-app";
import { Landing } from "./landing";
import type { BridgeStatusBody } from "./lib/types";

type Mode = { kind: "loading" } | { kind: "landing" } | { kind: "bridge"; status: BridgeStatusBody };

export function HomeClient() {
  const [mode, setMode] = useState<Mode>({ kind: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/status", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          setMode({ kind: "landing" });
          return;
        }
        const body = (await response.json()) as Partial<BridgeStatusBody>;
        if (body.service !== "kip-browser-bridge" || body.playlink == null) {
          setMode({ kind: "landing" });
          return;
        }
        setMode({ kind: "bridge", status: body as BridgeStatusBody });
      })
      .catch(() => {
        if (!controller.signal.aborted) setMode({ kind: "landing" });
      });
    return () => controller.abort();
  }, []);

  if (mode.kind === "loading") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-lg items-center justify-center px-5">
        <p className="text-slate-400">Checking local bridge…</p>
      </main>
    );
  }

  if (mode.kind === "landing") {
    return <Landing />;
  }

  if (!mode.status.controllerUi && !mode.status.gameplay) {
    return <Landing />;
  }

  return <ControllerApp />;
}
