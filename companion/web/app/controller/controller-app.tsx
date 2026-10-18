"use client";

import { useBridge } from "../lib/use-bridge";
import { ActiveScreen } from "./screens";
import { StatusChip } from "./ui";

export function ControllerApp() {
  const session = useBridge();

  return (
    <div className="min-h-dvh">
      {session.joined ? (
        <div className="fixed inset-x-0 top-0 z-20 flex items-center justify-between gap-2 bg-slate-950/80 px-3 py-2 text-[11px] backdrop-blur-sm">
          <div className="flex flex-wrap gap-2">
            <StatusChip>{session.connection}</StatusChip>
            {session.localAddress ? <StatusChip>{session.localAddress}</StatusChip> : null}
            {session.playerId != null ? <StatusChip>P{session.playerId}</StatusChip> : null}
            {!session.socketOpen ? <StatusChip>reconnecting…</StatusChip> : null}
          </div>
          <button
            type="button"
            data-testid="disconnect-button"
            className="border border-slate-600 px-2 py-1 text-slate-200"
            onClick={session.disconnect}
          >
            Disconnect
          </button>
        </div>
      ) : null}
      <div className={session.joined ? "pt-12" : undefined}>
        <ActiveScreen session={session} />
      </div>
    </div>
  );
}
