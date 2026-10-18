"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fileToJpegBase64 } from "../lib/portrait";
import { POWER_TYPE_LABELS, TypeString, type WireMessage } from "../lib/types";
import { recalledPlayerName, rememberPlayerName } from "../lib/uid";
import type { BridgeSession } from "../lib/use-bridge";
import { AnswerGrid, Button, ErrorBanner, Field, Input, Panel, Shell, StatusChip, Sub, TimerBar, Title } from "./ui";

function tintCss(message: WireMessage | null): string | undefined {
  const tint = message?.BackgroundTint as { r?: number; g?: number; b?: number } | undefined;
  if (!tint || tint.r == null) return undefined;
  const r = tint.r > 1 ? tint.r : tint.r * 255;
  const g = tint.g != null ? (tint.g > 1 ? tint.g : tint.g * 255) : 0;
  const b = tint.b != null ? (tint.b > 1 ? tint.b : tint.b * 255) : 0;
  return `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)})`;
}

function useCountdown(durationSec: number | null, active: boolean, onExpire?: () => void) {
  const [remaining, setRemaining] = useState(durationSec ?? 0);
  const expired = useRef(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    expired.current = false;
    setRemaining(durationSec ?? 0);
  }, [durationSec, active]);

  useEffect(() => {
    if (!active || durationSec == null || durationSec <= 0) return;
    const started = performance.now();
    const id = window.setInterval(() => {
      const left = Math.max(0, durationSec - (performance.now() - started) / 1000);
      setRemaining(left);
      if (left <= 0 && !expired.current) {
        expired.current = true;
        onExpireRef.current?.();
      }
    }, 50);
    return () => window.clearInterval(id);
  }, [active, durationSec]);

  return remaining;
}

export function ConnectScreen({ session }: { session: BridgeSession }) {
  const [code, setCode] = useState("");
  const [host, setHost] = useState("127.0.0.1");
  const [port, setPort] = useState("9066");
  const connecting = session.connection === "probing" || session.connection === "handshaking";

  return (
    <Shell>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-300">Knowledge Is Power</p>
      <Title>Connect</Title>
      <Sub>Discover a console on this Wi-Fi, or type its IP from the PlayStation network settings. The join code is on the PC bridge window. This page does not show it.</Sub>

      <div className="mt-4 flex flex-wrap gap-2">
        <StatusChip>WS {session.socketOpen ? "open" : "closed"}</StatusChip>
        <StatusChip>{session.connection ?? "idle"}</StatusChip>
        {session.playerId != null ? <StatusChip>Player {session.playerId}</StatusChip> : null}
      </div>

      {session.error ? (
        <ErrorBanner {...session.error} onDismiss={session.clearError} />
      ) : null}

      <Panel>
        <Button variant="secondary" onClick={session.discover} disabled={session.discovering || !session.socketOpen}>
          {session.discovering ? "Searching…" : "Discover consoles"}
        </Button>
        {session.consoles.length > 0 ? (
          <ul className="space-y-2">
            {session.consoles.map((console) => (
              <li key={`${console.host}-${console.hostId}`}>
                <button
                  type="button"
                  className="w-full border border-slate-600 bg-slate-900 px-3 py-3 text-left"
                  onClick={() => {
                    setHost(console.host);
                    setPort(String(console.gamePort || 9066));
                  }}
                >
                  <span className="block font-semibold text-cyan-50">{console.hostName || console.host}</span>
                  <span className="mt-1 block font-mono text-xs text-slate-400">
                    {console.host} · game {console.gamePort}
                    {console.awake ? "" : " · asleep"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-400">
            Awake consoles only. If the list stays empty, wake the PlayStation and type its IP. Guest Wi-Fi can block the phone from the PC even when the PC can see the console.
          </p>
        )}
      </Panel>

      <Panel>
        <Field label="Join code">
          <Input
            data-testid="join-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            maxLength={8}
            placeholder="From bridge terminal"
          />
        </Field>
        <Field label="Console IP">
          <Input
            data-testid="console-host"
            value={host}
            onChange={(e) => setHost(e.target.value.trim())}
            inputMode="decimal"
            placeholder="192.168.x.x"
          />
        </Field>
        <Field label="Game port">
          <Input
            data-testid="console-port"
            value={port}
            onChange={(e) => setPort(e.target.value.trim())}
            inputMode="numeric"
          />
        </Field>
        <Button
          data-testid="join-button"
          disabled={!code || !host || connecting || !session.socketOpen}
          onClick={() =>
            session.join({
              code: code.trim(),
              consoleHost: host.trim(),
              consolePort: Number(port) || 9066,
            })
          }
        >
          {connecting ? "Connecting…" : "Join session"}
        </Button>
      </Panel>

      <p className="mt-4 text-xs text-slate-500">
        Device UID <span className="font-mono">{session.uid.slice(0, 8)}…</span> stays in localStorage for reconnect.
        Two phones need two host IPv4 addresses — one IP cannot share UDP 9060.
      </p>
    </Shell>
  );
}

export function SetupScreen({ session }: { session: BridgeSession }) {
  const [name, setName] = useState(session.playerName ?? recalledPlayerName());
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const requestId = useRef(1);

  const available = session.avatars;

  async function onFile(file: File | null) {
    if (!file) return;
    setLocalError(null);
    try {
      const { base64 } = await fileToJpegBase64(file);
      setPreview(`data:image/jpeg;base64,${base64}`);
      return base64;
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Portrait failed");
      return null;
    }
  }

  return (
    <Shell accent={tintCss(session.colour)}>
      <Title>Player setup</Title>
      <Sub>
        Slot {session.slotId ?? "—"} · Player {session.playerId ?? "—"}
        {session.rejoining ? " · rejoining" : ""}
      </Sub>
      {session.error ? <ErrorBanner {...session.error} onDismiss={session.clearError} /> : null}

      <Panel>
        <Field label="Display name">
          <Input
            data-testid="player-name"
            value={name}
            maxLength={16}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />
        </Field>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-300/90">Avatar</p>
          {available.length === 0 ? (
            <p className="mt-2 text-sm text-slate-400">Waiting for avatar list from the console…</p>
          ) : (
            <div className="mt-2 grid grid-cols-2 gap-2">
              {available.map((avatar) => {
                const selected = session.selectedAvatarId === avatar.AvatarID;
                return (
                  <button
                    key={avatar.AvatarID}
                    type="button"
                    data-testid={`avatar-${avatar.AvatarID}`}
                    disabled={!avatar.Available && !selected}
                    onClick={() => {
                      if (session.selectedAvatarId && session.selectedAvatarId !== avatar.AvatarID) {
                        session.command({
                          TypeString: TypeString.ClientRequestAvatar,
                          RequestID: String(requestId.current++),
                          AvatarID: session.selectedAvatarId,
                          Request: false,
                        });
                      }
                      session.command({
                        TypeString: TypeString.ClientRequestAvatar,
                        RequestID: String(requestId.current++),
                        AvatarID: avatar.AvatarID,
                        Request: true,
                      });
                    }}
                    className={`min-h-12 border px-3 py-3 text-sm font-semibold ${
                      selected ? "border-coral-400 bg-coral-500/20 text-coral-50" : "border-slate-600 bg-slate-900"
                    } disabled:opacity-40`}
                  >
                    {avatar.AvatarID}
                    {!avatar.Available ? " (taken)" : ""}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <Field label="Selfie (optional)">
          <input
            data-testid="portrait-input"
            type="file"
            accept="image/*"
            capture="user"
            className="block w-full text-sm text-slate-300 file:mr-3 file:border-0 file:bg-teal-800 file:px-3 file:py-2 file:text-teal-50"
            onChange={async (e) => {
              const file = e.target.files?.[0] ?? null;
              const base64 = await onFile(file);
              if (base64) (e.target as HTMLInputElement).dataset.ready = base64;
            }}
          />
        </Field>
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Portrait preview" className="mx-auto h-28 w-28 object-cover" />
        ) : null}
        {localError ? <p className="text-sm text-rose-300">{localError}</p> : null}

        <Button
          data-testid="join-game-button"
          disabled={!name.trim() || !session.selectedAvatarId || busy}
          onClick={async () => {
            setBusy(true);
            setLocalError(null);
            rememberPlayerName(name.trim());
            session.setLocalPlayerName(name.trim());
            try {
              const input = document.querySelector<HTMLInputElement>('[data-testid="portrait-input"]');
              const ready = input?.dataset.ready;
              if (ready) {
                session.sendPortrait(name.trim(), ready);
              } else {
                session.command({
                  TypeString: TypeString.ClientPlayerProfile,
                  playerName: name.trim(),
                  uppercasePlayerName: name.trim().toUpperCase(),
                  deviceCultureName: "en-US",
                  playerCardId: session.selectedAvatarId,
                });
                session.markProfileSubmitted();
              }
            } catch (error) {
              setLocalError(error instanceof Error ? error.message : "Join failed");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Sending…" : "Join as this player"}
        </Button>
      </Panel>

      <p className="mt-3 text-xs text-slate-500">
        Portrait uses the system camera / file picker, then client-side JPEG. getUserMedia is not required.
        Costume masks are not supported.
      </p>
      <Button variant="ghost" className="mt-3" onClick={session.disconnect}>
        Disconnect
      </Button>
    </Shell>
  );
}

export function LobbyScreen({ session }: { session: BridgeSession }) {
  return (
    <Shell accent={tintCss(session.colour)}>
      <Title>Lobby</Title>
      <Sub>
        {session.playerName ?? session.displayName ?? "Player"} · slot {session.slotId ?? "—"}
      </Sub>
      <Panel>
        <p className="text-sm text-slate-300">Waiting for the host. Press start when the console enables it.</p>
        <Button
          data-testid="start-button"
          onClick={() => session.command({ TypeString: TypeString.StartGame, Response: 9 })}
        >
          Start / ready
        </Button>
      </Panel>
      {session.notice ? <p className="mt-3 text-sm text-amber-200">{session.notice}</p> : null}
    </Shell>
  );
}

export function HoldingScreen({ session }: { session: BridgeSession }) {
  return (
    <Shell accent={tintCss(session.colour)}>
      <Title>Hold</Title>
      <Sub>{session.holdingText || "Look at the TV"}</Sub>
      {session.holdingType === 8 ? (
        <p className="mt-3 text-sm text-amber-200">Holding type 8 seen on reconnect — unnamed in upstream source.</p>
      ) : null}
      <Panel>
        <p className="text-sm text-slate-400">Console is authoritative. This phone waits until the next phase arrives.</p>
      </Panel>
    </Shell>
  );
}

export function ContinueScreen({ session }: { session: BridgeSession }) {
  return (
    <Shell accent={tintCss(session.colour)}>
      <Title>Continue</Title>
      <Sub>When everyone is ready, continue the round.</Sub>
      <Panel>
        <Button
          data-testid="continue-button"
          onClick={() => session.command({ TypeString: TypeString.Continue, Response: 3 })}
        >
          Continue
        </Button>
      </Panel>
    </Shell>
  );
}

export function CategoryScreen({ session }: { session: BridgeSession }) {
  const choices = (session.category?.CategoryChoices as { DisplayText: string; DoorIndex: number }[] | undefined) ?? [];
  const header = String(session.category?.HeaderText ?? "Pick a category");
  const enabled = session.categoryChoiceEnabled;
  const [picked, setPicked] = useState<number | null>(null);

  return (
    <Shell accent={tintCss(session.category)}>
      <Title>Category</Title>
      <Sub>{header}</Sub>
      {!enabled ? <p className="mt-2 text-sm text-amber-200">Waiting for console to request a choice…</p> : null}
      <AnswerGrid
        answers={choices.map((c) => ({ id: c.DoorIndex, label: c.DisplayText }))}
        disabled={!enabled || picked != null}
        selected={picked}
        onSelect={(id) => {
          const door = Number(id);
          setPicked(door);
          session.command({ TypeString: TypeString.ClientCategorySelectChoice, ChosenCategoryIndex: door });
        }}
      />
    </Shell>
  );
}

export function CategoryOverrideScreen({ session }: { session: BridgeSession }) {
  const offerSeconds = Number(session.categoryOverride?.DurationSeconds ?? 0);
  const door = Number(session.categoryOverride?.DoorIndex ?? 0);
  const label = String(session.categoryOverride?.InitialCategorySelectChoice ?? "Override");
  const startedAt = useRef(performance.now());
  const [sent, setSent] = useState(false);
  const remaining = useCountdown(offerSeconds > 0 ? offerSeconds : null, !sent);

  useEffect(() => {
    startedAt.current = performance.now();
    setSent(false);
  }, [session.categoryOverride?.DoorIndex, session.categoryOverride?.InitialCategorySelectChoice]);

  return (
    <Shell>
      <Title>Power pick</Title>
      <Sub>
        Override door {door}: {label}
      </Sub>
      {offerSeconds > 0 ? <TimerBar remaining={remaining} total={offerSeconds} /> : null}
      <Panel>
        {sent ? (
          <p className="text-sm text-teal-200" data-testid="override-sent">
            Override sent (elapsed seconds). Waiting for console stop / success — do not send Stop response early.
          </p>
        ) : (
          <Button
            data-testid="override-button"
            onClick={() => {
              const elapsed = Math.max(0, (performance.now() - startedAt.current) / 1000);
              setSent(true);
              // Android PowerPickFragment: DurationSeconds = elapsed wall time, not offer length.
              session.command({
                TypeString: TypeString.ClientCategorySelectOverride,
                DurationSeconds: elapsed,
              });
            }}
          >
            Use power pick
          </Button>
        )}
        <p className="text-xs text-slate-400">
          Stop response is sent automatically when the console sends ServerStopCategorySelectOverride (Android parity).
        </p>
      </Panel>
    </Shell>
  );
}

export function TriviaScreen({ session }: { session: BridgeSession }) {
  const message = session.trivia;
  const questionId = String(message?.QuestionID ?? "");
  const duration = Number(message?.QuestionDuration ?? 0);
  const answers = (message?.Answers as { DisplayIndex: number; DisplayText: string }[] | undefined) ?? [];
  const powers = (message?.PowerPlays as { PowerType: number; Count: number }[] | undefined) ?? [];
  const [chosen, setChosen] = useState<number | null>(null);
  const startedAt = useRef(performance.now());
  const submitted = useRef(false);

  useEffect(() => {
    startedAt.current = performance.now();
    submitted.current = false;
    setChosen(null);
  }, [questionId]);

  const remaining = useCountdown(duration, chosen == null && Boolean(questionId));

  function submit(index: number) {
    if (submitted.current) return;
    submitted.current = true;
    setChosen(index);
    const answerTime = Math.min(duration, Math.max(0, (performance.now() - startedAt.current) / 1000));
    session.command({
      TypeString: TypeString.ClientTriviaAnswer,
      ChosenAnswerDisplayIndex: index,
      AnswerTime: answerTime,
      NumWrongAnswers: 0,
      _questionId: questionId,
    });
  }

  return (
    <Shell accent={tintCss(message)}>
      <Title>Trivia</Title>
      <Sub>{String(message?.QuestionText ?? "")}</Sub>
      <TimerBar remaining={remaining} total={duration || 1} />
      {powers.length > 0 ? (
        <p className="mt-2 text-xs text-amber-200">
          Active powers:{" "}
          {powers.map((p) => `${POWER_TYPE_LABELS[p.PowerType] ?? p.PowerType}×${p.Count}`).join(", ")}
        </p>
      ) : null}
      <AnswerGrid
        answers={answers.map((a) => ({ id: a.DisplayIndex, label: a.DisplayText }))}
        disabled={chosen != null}
        selected={chosen}
        onSelect={(id) => submit(Number(id))}
      />
      {chosen != null ? <p className="mt-3 text-sm text-teal-200">Answer sent. Wait for the TV.</p> : null}
    </Shell>
  );
}

export function PowerPlayScreen({ session }: { session: BridgeSession }) {
  const message = session.powerPlay;
  const plays = (message?.PowerPlays as {
    DisplayIndex: number;
    PowerType: number;
    TargetCount: number;
    PowerPlayTargets: number[];
  }[] | undefined) ?? [];
  const players = (message?.PowerPlayPlayers as { SlotIndex: number; Name: string; Self: boolean; Away: boolean }[] | undefined) ?? [];
  const [picked, setPicked] = useState<number | null>(null);
  const [sent, setSent] = useState(false);

  const selected = plays.find((p) => p.DisplayIndex === picked) ?? null;

  function sendChoice(slot: number, targetSlots: number[]) {
    setSent(true);
    session.command({
      TypeString: TypeString.ClientPowerPlayChoice,
      PowerPlaySlotIndex: slot,
      TargetSlotIndex: targetSlots,
    });
  }

  // Android: TargetCount > 1 = confirm "Everyone" with PowerPlayTargets verbatim;
  // TargetCount == 1 = pick one slot from PowerPlayTargets (may include self);
  // TargetCount <= 0 = no target list.
  const mode =
    selected == null
      ? "pick"
      : selected.TargetCount > 1
        ? "everyone"
        : selected.TargetCount === 1
          ? "single"
          : "none";

  const candidates = useMemo(() => {
    if (!selected || mode !== "single") return [];
    const listed = selected.PowerPlayTargets ?? [];
    return players.filter((p) => listed.includes(p.SlotIndex) && !p.Away);
  }, [selected, players, mode]);

  return (
    <Shell>
      <Title>Power play</Title>
      <Sub>Pick a power. Empty choice (−1) is sent by the bridge if the console requests a choice and none was made.</Sub>
      <div className="mt-4 grid gap-2">
        {plays.map((play) => (
          <button
            key={play.DisplayIndex}
            type="button"
            disabled={sent}
            data-testid={`power-${play.DisplayIndex}`}
            onClick={() => {
              setPicked(play.DisplayIndex);
              if (play.TargetCount <= 0) sendChoice(play.DisplayIndex, []);
            }}
            className={`min-h-14 border px-4 py-3 text-left ${
              picked === play.DisplayIndex ? "border-coral-400 bg-coral-500/20" : "border-slate-600 bg-slate-900"
            }`}
          >
            <span className="font-semibold">{POWER_TYPE_LABELS[play.PowerType] ?? `Power ${play.PowerType}`}</span>
            <span className="mt-1 block text-xs text-slate-400">
              targetCount {play.TargetCount} · listed [{(play.PowerPlayTargets ?? []).join(", ")}]
            </span>
          </button>
        ))}
      </div>
      {mode === "everyone" && selected && !sent ? (
        <Panel>
          <p className="text-sm text-slate-300">Confirm multi-target (Everyone). Echoes server PowerPlayTargets only.</p>
          <Button
            data-testid="power-everyone"
            onClick={() => sendChoice(selected.DisplayIndex, [...(selected.PowerPlayTargets ?? [])])}
          >
            Everyone
          </Button>
        </Panel>
      ) : null}
      {mode === "single" && selected && !sent ? (
        <Panel>
          <p className="text-sm text-slate-300">Choose one target from the console list</p>
          <div className="grid gap-2">
            {candidates.map((player) => (
              <button
                key={player.SlotIndex}
                type="button"
                data-testid={`power-target-${player.SlotIndex}`}
                className="min-h-12 border border-slate-600 px-3 py-2 text-left"
                onClick={() => sendChoice(selected.DisplayIndex, [player.SlotIndex])}
              >
                {player.Name} (slot {player.SlotIndex}){player.Self ? " · you" : ""}
              </button>
            ))}
          </div>
        </Panel>
      ) : null}
      {sent ? <p className="mt-3 text-sm text-teal-200">Power choice sent.</p> : null}
    </Shell>
  );
}

export function LinkingScreen({ session }: { session: BridgeSession }) {
  const message = session.linking;
  const duration = Number(message?.QuestionDuration ?? 0);
  const answers = (message?.LinkingAnswers as { DisplayText: string; AnswerID: string; Direction: number; MatchIndex: number }[] | undefined) ?? [];
  const left = answers.filter((a) => a.Direction === 0);
  const right = answers.filter((a) => a.Direction === 1);
  const [fromId, setFromId] = useState<string | null>(null);
  const [pairs, setPairs] = useState<{ FromID: string; ToID: string; Correct: boolean }[]>([]);
  const [sent, setSent] = useState(false);
  const pairsRef = useRef(pairs);
  pairsRef.current = pairs;
  const sentRef = useRef(sent);
  sentRef.current = sent;

  function submit(nextPairs: typeof pairs) {
    if (sentRef.current) return;
    setSent(true);
    sentRef.current = true;
    const correct = nextPairs.filter((p) => p.Correct).length;
    session.command({
      TypeString: TypeString.ClientLinkingAnswer,
      ClientLinkingCorrectAnswerCount: correct,
      ClientAnswers: nextPairs,
    });
  }

  const remaining = useCountdown(duration, !sent, () => submit(pairsRef.current));

  return (
    <Shell>
      <Title>Linking</Title>
      <Sub>{String(message?.QuestionText ?? "Match the pairs")}</Sub>
      <TimerBar remaining={remaining} total={duration || 1} />
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="space-y-2">
          {left.map((item) => (
            <button
              key={item.AnswerID}
              type="button"
              disabled={sent || pairs.some((p) => p.FromID === item.AnswerID)}
              onClick={() => setFromId(item.AnswerID)}
              className={`min-h-12 w-full border px-2 py-2 text-sm ${fromId === item.AnswerID ? "border-coral-400" : "border-slate-600"}`}
            >
              {item.DisplayText}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {right.map((item) => (
            <button
              key={item.AnswerID}
              type="button"
              disabled={sent || !fromId || pairs.some((p) => p.ToID === item.AnswerID)}
              onClick={() => {
                if (!fromId) return;
                const from = left.find((a) => a.AnswerID === fromId);
                const correct = Boolean(from && from.MatchIndex === item.MatchIndex);
                const next = [...pairs, { FromID: fromId, ToID: item.AnswerID, Correct: correct }];
                setPairs(next);
                setFromId(null);
                if (next.length >= Math.min(left.length, right.length)) submit(next);
              }}
              className="min-h-12 w-full border border-slate-600 px-2 py-2 text-sm"
            >
              {item.DisplayText}
            </button>
          ))}
        </div>
      </div>
      {!sent ? (
        <Button className="mt-4" variant="secondary" onClick={() => submit(pairs)}>
          Submit links ({pairs.length})
        </Button>
      ) : (
        <p className="mt-3 text-sm text-teal-200">Links sent.</p>
      )}
    </Shell>
  );
}

export function OrderingScreen({ session }: { session: BridgeSession }) {
  const message = session.ordering;
  const duration = Number(message?.QuestionDuration ?? 0);
  const data = (message?.OrderingAnswerData as { WordsInCorrectOrder: string[] }[] | undefined) ?? [];
  const words = data[0]?.WordsInCorrectOrder ?? [];
  const [order, setOrder] = useState<string[]>([]);
  const [pool, setPool] = useState<string[]>([]);
  const [sent, setSent] = useState(false);
  const remaining = useCountdown(duration, !sent);

  useEffect(() => {
    const shuffled = [...words].sort(() => Math.random() - 0.5);
    setPool(shuffled);
    setOrder([]);
    setSent(false);
  }, [message?.ChallengeId, words.join("|")]);

  return (
    <Shell>
      <Title>Ordering</Title>
      <Sub>{String(message?.QuestionText ?? "Put these in order")}</Sub>
      <TimerBar remaining={remaining} total={duration || 1} />
      <Panel>
        <p className="text-xs uppercase tracking-wide text-teal-300">Your order</p>
        <div className="flex flex-wrap gap-2">
          {order.map((word, index) => (
            <button
              key={`${word}-${index}`}
              type="button"
              className="border border-coral-400/60 bg-coral-500/10 px-3 py-2 text-sm"
              onClick={() => {
                setOrder((prev) => prev.filter((_, i) => i !== index));
                setPool((prev) => [...prev, word]);
              }}
            >
              {word}
            </button>
          ))}
        </div>
        <p className="text-xs uppercase tracking-wide text-teal-300">Remaining</p>
        <div className="flex flex-wrap gap-2">
          {pool.map((word, index) => (
            <button
              key={`${word}-pool-${index}`}
              type="button"
              className="border border-slate-600 px-3 py-2 text-sm"
              onClick={() => {
                setPool((prev) => prev.filter((_, i) => i !== index));
                setOrder((prev) => [...prev, word]);
              }}
            >
              {word}
            </button>
          ))}
        </div>
        <Button
          disabled={sent}
          onClick={() => {
            setSent(true);
            let correct = 0;
            for (let i = 0; i < words.length; i += 1) {
              if (order[i] === words[i]) correct += 1;
            }
            session.command({
              TypeString: TypeString.ClientOrderingAnswer,
              ClientOrderingCorrectAnswerCount: correct,
            });
          }}
        >
          Submit order
        </Button>
      </Panel>
    </Shell>
  );
}

export function SortingScreen({ session }: { session: BridgeSession }) {
  const message = session.sorting;
  const duration = Number(message?.QuestionDuration ?? 0);
  const leftLabel = String(message?.LeftBucketLabel ?? "Left");
  const rightLabel = String(message?.RightBucketLabel ?? "Right");
  const leftId = String(message?.LeftBucketID ?? "L");
  const rightId = String(message?.RightBucketID ?? "R");
  const answers = (message?.SortingAnswers as { DisplayText: string; AnswerID: string; AnswerDirection: number }[] | undefined) ?? [];
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<{ AnswerID: string; AnswerBucketID: string; Correct: boolean }[]>([]);
  const [sent, setSent] = useState(false);
  const resultsRef = useRef(results);
  resultsRef.current = results;
  const sentRef = useRef(sent);
  sentRef.current = sent;

  function finish(next: typeof results) {
    if (sentRef.current) return;
    setSent(true);
    sentRef.current = true;
    session.command({
      TypeString: TypeString.ClientSortingAnswer,
      ClientSortingCorrectAnswerCount: next.filter((r) => r.Correct).length,
      SortingAnswers: next,
    });
  }

  const remaining = useCountdown(duration, !sent, () => finish(resultsRef.current));
  const current = answers[index];

  function place(bucketId: string, direction: number) {
    if (!current || sent) return;
    const entry = {
      AnswerID: current.AnswerID,
      AnswerBucketID: bucketId,
      Correct: current.AnswerDirection === direction,
    };
    const next = [...results, entry];
    setResults(next);
    if (index + 1 >= answers.length) finish(next);
    else setIndex(index + 1);
  }

  return (
    <Shell>
      <Title>Sorting</Title>
      <Sub>{String(message?.QuestionText ?? "")}</Sub>
      <TimerBar remaining={remaining} total={duration || 1} />
      {current && !sent ? (
        <Panel>
          <p className="text-lg font-semibold text-cyan-50">{current.DisplayText}</p>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => place(leftId, 1)}>{leftLabel}</Button>
            <Button variant="secondary" onClick={() => place(rightId, 2)}>
              {rightLabel}
            </Button>
          </div>
          <p className="text-xs text-slate-400">
            {index + 1} / {answers.length}
          </p>
        </Panel>
      ) : (
        <p className="mt-4 text-sm text-teal-200">Sorting answer sent.</p>
      )}
    </Shell>
  );
}

export function EliminatingScreen({ session }: { session: BridgeSession }) {
  const message = session.eliminating;
  const duration = Number(message?.QuestionDuration ?? 0);
  const rows = (message?.EliminatingAnswerData as { CorrectAnswer: string; IncorrectAnswers: string[] }[] | undefined) ?? [];
  const [row, setRow] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [sent, setSent] = useState(false);
  const remaining = useCountdown(duration, !sent);
  const current = rows[row];
  const options = useMemo(() => {
    if (!current) return [];
    return [current.CorrectAnswer, ...(current.IncorrectAnswers ?? [])].sort(() => Math.random() - 0.5);
  }, [current, row]);

  return (
    <Shell>
      <Title>Elimination</Title>
      <Sub>{String(message?.QuestionText ?? "Decades elimination")}</Sub>
      <p className="mt-1 text-xs text-amber-200">Decades minigame — encoded, console acceptance unproven.</p>
      <TimerBar remaining={remaining} total={duration || 1} />
      {current && !sent ? (
        <AnswerGrid
          answers={options.map((label, i) => ({ id: i, label }))}
          onSelect={(id) => {
            const pick = options[Number(id)];
            const nextCorrect = correctCount + (pick === current.CorrectAnswer ? 1 : 0);
            setCorrectCount(nextCorrect);
            if (row + 1 >= rows.length) {
              setSent(true);
              session.command({ TypeString: TypeString.ClientEliminatingAnswer, AnswerCount: nextCorrect });
            } else setRow(row + 1);
          }}
        />
      ) : (
        <p className="mt-3 text-sm text-teal-200">Answer sent.</p>
      )}
    </Shell>
  );
}

export function MissingLetterScreen({ session }: { session: BridgeSession }) {
  const message = session.missingLetter;
  const duration = Number(message?.QuestionDuration ?? 0);
  const rows = (message?.MissingLetterAnswerData as { correct: string; letters: string; finalDisplay: string }[] | undefined) ?? [];
  const [row, setRow] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [sent, setSent] = useState(false);
  const remaining = useCountdown(duration, !sent);
  const current = rows[row];

  return (
    <Shell>
      <Title>Missing letter</Title>
      <Sub>{String(message?.Question ?? "Fill the letter")}</Sub>
      <p className="mt-1 text-xs text-amber-200">Decades prototype message — not silently faked as classic play.</p>
      <TimerBar remaining={remaining} total={duration || 1} />
      {current && !sent ? (
        <Panel>
          <p className="font-mono text-xl tracking-widest">{current.finalDisplay}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {[...current.letters].map((letter, index) => (
              <button
                key={`${letter}-${index}`}
                type="button"
                className="min-h-12 min-w-12 border border-slate-600 bg-slate-900 text-lg font-bold"
                onClick={() => {
                  const next = correctCount + (letter === current.correct ? 1 : 0);
                  setCorrectCount(next);
                  if (row + 1 >= rows.length) {
                    setSent(true);
                    session.command({
                      TypeString: TypeString.ClientMissingLetterAnswer,
                      ClientMissingLetterCorrectAnswerCount: next,
                    });
                  } else setRow(row + 1);
                }}
              >
                {letter}
              </button>
            ))}
          </div>
        </Panel>
      ) : (
        <p className="mt-3 text-sm text-teal-200">Answer sent.</p>
      )}
    </Shell>
  );
}

export function MatchingScreen({ session }: { session: BridgeSession }) {
  const message = session.matching;
  const duration = Number(message?.QuestionDuration ?? 0);
  const pairs = (message?.MatchingData as { QuestionText: string; AnswerText: string }[] | undefined) ?? [];
  const dummies = (message?.DummyAnswerData as string[] | undefined) ?? [];
  const [index, setIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [sent, setSent] = useState(false);
  const remaining = useCountdown(duration, !sent);
  const current = pairs[index];
  const options = useMemo(() => {
    if (!current) return [];
    return [current.AnswerText, ...dummies].sort(() => Math.random() - 0.5);
  }, [current, dummies, index]);

  return (
    <Shell>
      <Title>Matching</Title>
      <Sub>Decades matching challenge</Sub>
      <TimerBar remaining={remaining} total={duration || 1} />
      {current && !sent ? (
        <>
          <p className="mt-4 text-lg font-semibold">{current.QuestionText}</p>
          <AnswerGrid
            answers={options.map((label, i) => ({ id: i, label }))}
            onSelect={(id) => {
              const pick = options[Number(id)];
              const next = correctCount + (pick === current.AnswerText ? 1 : 0);
              setCorrectCount(next);
              session.command({ TypeString: TypeString.ClientOngoingChallenge, CorrectAnswerCount: next });
              if (index + 1 >= pairs.length) {
                setSent(true);
                session.command({ TypeString: TypeString.ClientMatchingAnswer, ClientMatchingCorrectAnswerCount: next });
              } else setIndex(index + 1);
            }}
          />
        </>
      ) : (
        <p className="mt-3 text-sm text-teal-200">Matching complete.</p>
      )}
    </Shell>
  );
}

export function EndFactScreen({ session }: { session: BridgeSession }) {
  return (
    <Shell>
      <Title>End of game</Title>
      <Sub>Fact phase from the console. FactCount is sent by the bridge (63).</Sub>
      <Panel>
        <p className="text-sm text-slate-300">
          action {String(session.endFact?.action ?? "—")} · fact {String(session.endFact?.FactNumber ?? "—")}
        </p>
        <p className="text-sm text-slate-400">Look at the TV for the fact display. Local factoid libraries are not shipped.</p>
      </Panel>
    </Shell>
  );
}

export function ActiveScreen({ session }: { session: BridgeSession }) {
  if (!session.joined || session.connection !== "assigned") {
    return <ConnectScreen session={session} />;
  }
  if (!session.profileSubmitted && session.phase === "setup") {
    return <SetupScreen session={session} />;
  }
  switch (session.phase) {
    case "connect":
      return <ConnectScreen session={session} />;
    case "setup":
      return <SetupScreen session={session} />;
    case "lobby":
      return <LobbyScreen session={session} />;
    case "holding":
      return <HoldingScreen session={session} />;
    case "continue":
      return <ContinueScreen session={session} />;
    case "category":
      return <CategoryScreen session={session} />;
    case "categoryOverride":
      return <CategoryOverrideScreen session={session} />;
    case "trivia":
      return <TriviaScreen session={session} />;
    case "powerPlay":
      return <PowerPlayScreen session={session} />;
    case "linking":
      return <LinkingScreen session={session} />;
    case "ordering":
      return <OrderingScreen session={session} />;
    case "sorting":
      return <SortingScreen session={session} />;
    case "eliminating":
      return <EliminatingScreen session={session} />;
    case "missingLetter":
      return <MissingLetterScreen session={session} />;
    case "matching":
      return <MatchingScreen session={session} />;
    case "endFact":
      return <EndFactScreen session={session} />;
    default:
      return <HoldingScreen session={session} />;
  }
}
