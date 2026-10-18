"use client";

export function Landing() {
  return (
    <main className="relative mx-auto flex min-h-dvh max-w-xl flex-col gap-6 px-5 py-10">
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-90"
        style={{
          background:
            "radial-gradient(90% 60% at 10% 0%, rgba(20,184,166,0.22), transparent 55%), radial-gradient(70% 50% at 100% 10%, rgba(251,113,133,0.16), transparent 50%), linear-gradient(165deg, #07141f, #0f2433)",
        }}
      />
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-300">Knowledge Is Power</p>
        <h1 className="font-display text-4xl font-bold leading-tight text-cyan-50">Browser companion launcher</h1>
        <p className="text-slate-300">
          This public page cannot join a PlayStation session. Safari blocks mixed-content WebSockets from HTTPS to a
          LAN bridge. Open the controller from the computer that runs the bridge.
        </p>
      </header>

      <section className="border border-cyan-900/50 bg-slate-950/60 p-5">
        <h2 className="font-display text-xl font-semibold text-cyan-50">How to play</h2>
        <ol className="mt-4 list-decimal space-y-3 pl-5 text-slate-300">
          <li>On a PC or Mac on the same Wi-Fi as the PlayStation, clone this repository and open <code className="font-mono text-teal-200">companion/</code>.</li>
          <li>
            Run <code className="font-mono text-teal-200">npm install</code>, <code className="font-mono text-teal-200">npm run build</code>, then{" "}
            <code className="font-mono text-teal-200">npm start</code>.
          </li>
          <li>Copy the join code printed in the terminal. Open one of the printed <code className="font-mono text-teal-200">http://</code> LAN URLs in iPhone Safari.</li>
          <li>Discover or type the console IP, enter the join code, set name and avatar, then play. The TV stays authoritative.</li>
        </ol>
      </section>

      <section className="border border-slate-700 bg-slate-950/40 p-5 text-sm text-slate-300">
        <h2 className="font-semibold text-slate-100">Limits (not silently faked)</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>One bridge IPv4 address = one phone on UDP 9060. Extra phones need extra host addresses.</li>
          <li>Android players keep using Reverse of Power on their own addresses.</li>
          <li>No Sony / Wish Studios art, masks, or audio.</li>
          <li>Decades minigames are forwarded when the console sends them; full fidelity is unproven.</li>
        </ul>
      </section>

      <footer className="mt-auto space-y-2 text-sm text-slate-500">
        <p>
          Derived from{" "}
          <a className="underline decoration-teal-700 underline-offset-2" href="https://github.com/synchrone/reverse-of-power">
            synchrone/reverse-of-power
          </a>{" "}
          commit e9543047cd73. GPL-3.0 only.
        </p>
        <p>Not affiliated with Sony Interactive Entertainment or Wish Studios.</p>
      </footer>
    </main>
  );
}
