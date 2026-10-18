"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  type AvatarStatus,
  type BridgeErrorFrame,
  type BridgeSnapshotFrame,
  type BridgeStateFrame,
  type BridgeStatusBody,
  type ConnectionState,
  type ConsoleInfo,
  type WireMessage,
  QUIZ_ACTION,
  TypeString,
  errorHint,
} from "./types";
import { getOrCreateDeviceUid } from "./uid";

export type GamePhase =
  | "connect"
  | "setup"
  | "lobby"
  | "holding"
  | "continue"
  | "category"
  | "categoryOverride"
  | "trivia"
  | "powerPlay"
  | "linking"
  | "ordering"
  | "sorting"
  | "eliminating"
  | "missingLetter"
  | "matching"
  | "endFact";

export interface BridgeSession {
  ready: boolean;
  socketOpen: boolean;
  status: BridgeStatusBody | null;
  connection: ConnectionState | null;
  playerId: number | null;
  slotId: number | null;
  displayName: string | null;
  localAddress: string | null;
  decades: boolean;
  uid: string;
  joined: boolean;
  phase: GamePhase;
  avatars: AvatarStatus[];
  selectedAvatarId: string | null;
  playerName: string | null;
  lastScreen: WireMessage | null;
  holdingText: string;
  holdingType: number | null;
  category: WireMessage | null;
  categoryOverride: WireMessage | null;
  trivia: WireMessage | null;
  powerPlay: WireMessage | null;
  linking: WireMessage | null;
  ordering: WireMessage | null;
  sorting: WireMessage | null;
  eliminating: WireMessage | null;
  missingLetter: WireMessage | null;
  matching: WireMessage | null;
  endFact: WireMessage | null;
  categoryChoiceEnabled: boolean;
  consoles: ConsoleInfo[];
  discovering: boolean;
  error: { code: string; detail: string; hint: string } | null;
  notice: string | null;
  colour: WireMessage | null;
  profileSubmitted: boolean;
  rejoining: boolean;
  clearError: () => void;
  discover: () => void;
  join: (input: { code: string; consoleHost: string; consolePort?: number }) => void;
  disconnect: () => void;
  command: (message: Record<string, unknown>) => void;
  sendPortrait: (playerName: string, imageBase64: string) => void;
  requestImage: (guid: string) => void;
  setLocalPlayerName: (name: string) => void;
  markProfileSubmitted: () => void;
}

function sessionUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/session`;
}

function asAvatars(messages: WireMessage[]): AvatarStatus[] {
  const map = new Map<string, AvatarStatus>();
  for (const message of messages) {
    if (message.TypeString !== TypeString.ServerAvatarStatus) continue;
    if (typeof message.AvatarID !== "string") continue;
    map.set(message.AvatarID, {
      AvatarID: message.AvatarID,
      Available: Boolean(message.Available),
    });
  }
  return [...map.values()];
}

function phaseFromScreen(screen: WireMessage | null, fallback: GamePhase): GamePhase {
  if (!screen) return fallback;
  switch (screen.TypeString) {
    case TypeString.ClientHoldingScreen:
    case TypeString.RejoiningProfile:
      return "holding";
    case TypeString.ClientQuizCommand: {
      const action = Number(screen.action);
      if (action === QUIZ_ACTION.CONTINUE) return "continue";
      if (action === QUIZ_ACTION.READY) return "lobby";
      if (action === QUIZ_ACTION.RESET_TO_NAME) return "setup";
      return "holding";
    }
    case TypeString.ServerCategorySelectChoices:
      return "category";
    case TypeString.ServerBeginTrivia:
      return "trivia";
    case TypeString.ServerBeginPowerPlay:
      return "powerPlay";
    case TypeString.ServerBeginLinking:
      return "linking";
    case TypeString.ServerBeginOrdering:
      return "ordering";
    case TypeString.ServerBeginSorting:
      return "sorting";
    case TypeString.ServerBeginEliminating:
      return "eliminating";
    case TypeString.ServerBeginMissingLetter:
      return "missingLetter";
    case TypeString.ServerBeginMatching:
      return "matching";
    case TypeString.ClientEndOfGameFact:
      return "endFact";
    default:
      return fallback;
  }
}

export function useBridge(): BridgeSession {
  const [ready, setReady] = useState(false);
  const [socketOpen, setSocketOpen] = useState(false);
  const [status, setStatus] = useState<BridgeStatusBody | null>(null);
  const [connection, setConnection] = useState<ConnectionState | null>(null);
  const [playerId, setPlayerId] = useState<number | null>(null);
  const [slotId, setSlotId] = useState<number | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [localAddress, setLocalAddress] = useState<string | null>(null);
  const [decades, setDecades] = useState(false);
  const [uid] = useState(() => (typeof window === "undefined" ? "" : getOrCreateDeviceUid()));
  const [joined, setJoined] = useState(false);
  const [phase, setPhase] = useState<GamePhase>("connect");
  const [avatars, setAvatars] = useState<AvatarStatus[]>([]);
  const [selectedAvatarId, setSelectedAvatarId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState<string | null>(null);
  const [lastScreen, setLastScreen] = useState<WireMessage | null>(null);
  const [holdingText, setHoldingText] = useState("Look at the TV");
  const [holdingType, setHoldingType] = useState<number | null>(null);
  const [category, setCategory] = useState<WireMessage | null>(null);
  const [categoryOverride, setCategoryOverride] = useState<WireMessage | null>(null);
  const [trivia, setTrivia] = useState<WireMessage | null>(null);
  const [powerPlay, setPowerPlay] = useState<WireMessage | null>(null);
  const [linking, setLinking] = useState<WireMessage | null>(null);
  const [ordering, setOrdering] = useState<WireMessage | null>(null);
  const [sorting, setSorting] = useState<WireMessage | null>(null);
  const [eliminating, setEliminating] = useState<WireMessage | null>(null);
  const [missingLetter, setMissingLetter] = useState<WireMessage | null>(null);
  const [matching, setMatching] = useState<WireMessage | null>(null);
  const [endFact, setEndFact] = useState<WireMessage | null>(null);
  const [categoryChoiceEnabled, setCategoryChoiceEnabled] = useState(false);
  const [consoles, setConsoles] = useState<ConsoleInfo[]>([]);
  const [discovering, setDiscovering] = useState(false);
  const [error, setError] = useState<BridgeSession["error"]>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [colour, setColour] = useState<WireMessage | null>(null);
  const [profileSubmitted, setProfileSubmitted] = useState(false);
  const [rejoining, setRejoining] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const joinPayloadRef = useRef<{ code: string; consoleHost: string; consolePort?: number } | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intentionalClose = useRef(false);
  const activeTriviaId = useRef<string | null>(null);
  const overrideSentRef = useRef(false);
  const sendRawRef = useRef<(payload: Record<string, unknown>) => void>(() => {});

  const pushError = useCallback((code: string, detail: string) => {
    setError({ code, detail, hint: errorHint(code) });
  }, []);

  const categoryRef = useRef<WireMessage | null>(null);
  categoryRef.current = category;

  const applyScreen = useCallback((message: WireMessage, fromSnapshot = false) => {
    setLastScreen(message);
    switch (message.TypeString) {
      case TypeString.ClientHoldingScreen:
        setHoldingText(String(message.HoldingScreenText ?? "Look at the TV"));
        setHoldingType(typeof message.HoldingScreenType === "number" ? message.HoldingScreenType : null);
        setPhase("holding");
        break;
      case TypeString.RejoiningProfile:
        setRejoining(true);
        setPlayerName(typeof message.Name === "string" ? message.Name : null);
        setSelectedAvatarId(typeof message.AvatarID === "string" ? message.AvatarID : null);
        setProfileSubmitted(true);
        setPhase("holding");
        break;
      case TypeString.ClientQuizCommand: {
        const action = Number(message.action);
        if (action === QUIZ_ACTION.CONTINUE) setPhase("continue");
        else if (action === QUIZ_ACTION.READY) setPhase("lobby");
        else if (action === QUIZ_ACTION.RESET_TO_NAME) {
          setProfileSubmitted(false);
          setPhase("setup");
        } else if (action === QUIZ_ACTION.EXIT || action === QUIZ_ACTION.PAUSED || action === QUIZ_ACTION.UNPAUSED) {
          setNotice(`Quiz action ${action} has no Android UI branch. Waiting.`);
          setPhase("holding");
        }
        break;
      }
      case TypeString.ServerCategorySelectChoices:
        setCategory(message);
        setCategoryChoiceEnabled(false);
        setCategoryOverride(null);
        setPhase("category");
        break;
      case TypeString.ServerRequestCategorySelectChoice:
        setCategoryChoiceEnabled(true);
        break;
      case TypeString.ServerBeginCategorySelectOverride:
        overrideSentRef.current = false;
        setCategoryOverride(message);
        setPhase("categoryOverride");
        break;
      case TypeString.ServerStopCategorySelectOverride:
        // Android PowerPickFragment: Stop response only after console stop, with OverrideSent flag.
        sendRawRef.current({
          type: "bridge.command",
          message: {
            TypeString: TypeString.ClientStopCategorySelectOverrideResponse,
            OverrideSent: overrideSentRef.current,
          },
        });
        setCategoryOverride(null);
        if (!overrideSentRef.current) setPhase("holding");
        break;
      case TypeString.ServerCategorySelectOverrideSuccess:
        setCategoryOverride(null);
        setPhase("holding");
        break;
      case TypeString.ServerBeginTrivia: {
        const questionId = String(message.QuestionID ?? "");
        activeTriviaId.current = questionId;
        setTrivia(message);
        setPhase("trivia");
        break;
      }
      case TypeString.ServerBeginPowerPlay:
        setPowerPlay(message);
        setPhase("powerPlay");
        break;
      case TypeString.ServerRequestPowerPlayChoice:
        if (!fromSnapshot) setNotice("Power-play choice requested");
        break;
      case TypeString.ServerBeginLinking:
        setLinking(message);
        setPhase("linking");
        break;
      case TypeString.ServerBeginOrdering:
        setOrdering(message);
        setPhase("ordering");
        break;
      case TypeString.ServerBeginSorting:
        setSorting(message);
        setPhase("sorting");
        break;
      case TypeString.ServerBeginEliminating:
        setEliminating(message);
        setPhase("eliminating");
        break;
      case TypeString.ServerBeginMissingLetter:
        setMissingLetter(message);
        setPhase("missingLetter");
        break;
      case TypeString.ServerBeginMatching:
        setMatching(message);
        setPhase("matching");
        break;
      case TypeString.ClientEndOfGameFact:
        setEndFact(message);
        setPhase("endFact");
        break;
      case TypeString.ServerColour:
        setColour(message);
        break;
      case TypeString.ServerAvatarStatus: {
        const id = String(message.AvatarID ?? "");
        if (!id) break;
        setAvatars((prev) => {
          const next = new Map(prev.map((a) => [a.AvatarID, a]));
          next.set(id, { AvatarID: id, Available: Boolean(message.Available) });
          return [...next.values()];
        });
        break;
      }
      case TypeString.ServerAvatarRequestResponse:
        if (message.Available === false) {
          setNotice(`Avatar ${String(message.AvatarID)} was not available`);
        }
        break;
      default:
        break;
    }
  }, []);

  const applySnapshot = useCallback(
    (frame: BridgeSnapshotFrame) => {
      setConnection(frame.connection);
      setPlayerId(frame.playerId);
      setSlotId(frame.slotId);
      setDisplayName(frame.displayName);
      setLocalAddress(frame.localAddress);
      setDecades(frame.decades);
      setSelectedAvatarId(frame.selectedAvatarId);
      setPlayerName(frame.playerName);
      setAvatars(asAvatars(frame.avatars ?? []));
      setLastScreen(frame.lastScreen);
      setJoined(true);
      if (frame.playerName && frame.selectedAvatarId) setProfileSubmitted(true);
      if (frame.lastScreen) {
        applyScreen(frame.lastScreen, true);
        setPhase(
          phaseFromScreen(
            frame.lastScreen,
            frame.selectedAvatarId && frame.playerName ? "holding" : "setup",
          ),
        );
      } else if (frame.connection === "assigned") {
        setPhase(frame.selectedAvatarId && frame.playerName ? "lobby" : "setup");
      }
    },
    [applyScreen],
  );

  const handleFrame = useCallback(
    (raw: unknown) => {
      if (!raw || typeof raw !== "object") return;
      const frame = raw as Record<string, unknown>;
      switch (frame.type) {
        case "bridge.status":
          setStatus(frame as unknown as BridgeStatusBody);
          setReady(true);
          break;
        case "bridge.state": {
          const state = frame as unknown as BridgeStateFrame;
          setConnection(state.connection);
          setPlayerId(state.playerId);
          setSlotId(state.slotId);
          setDisplayName(state.displayName);
          setLocalAddress(state.localAddress);
          setDecades(state.decades);
          if (state.connection === "assigned") {
            setJoined(true);
            setPhase((prev) => (prev === "connect" ? "setup" : prev));
          }
          if (state.connection === "closed") {
            setJoined(false);
            setPhase("connect");
          }
          break;
        }
        case "bridge.snapshot":
          applySnapshot(frame as unknown as BridgeSnapshotFrame);
          break;
        case "bridge.event":
          if (frame.message && typeof frame.message === "object") {
            applyScreen(frame.message as WireMessage);
          }
          break;
        case "bridge.consoles":
          setDiscovering(false);
          setConsoles(Array.isArray(frame.consoles) ? (frame.consoles as ConsoleInfo[]) : []);
          break;
        case "bridge.error": {
          const err = frame as unknown as BridgeErrorFrame;
          pushError(err.code, err.detail);
          if (err.code === "bad_join_code" || err.code === "endpoint_exhausted" || err.code === "connect_timeout") {
            setJoined(false);
            setPhase("connect");
          }
          break;
        }
        case "bridge.notice":
          setNotice(String(frame.detail ?? frame.code ?? "notice"));
          break;
        case "bridge.rejected":
          pushError("not_joined", String(frame.reason ?? "not_joined"));
          break;
        default:
          break;
      }
    },
    [applySnapshot, applyScreen, pushError],
  );

  const connectSocket = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }
    intentionalClose.current = false;
    const ws = new WebSocket(sessionUrl());
    wsRef.current = ws;
    ws.addEventListener("open", () => {
      setSocketOpen(true);
      const pending = joinPayloadRef.current;
      if (pending) {
        ws.send(
          JSON.stringify({
            type: "bridge.join",
            code: pending.code,
            uid,
            consoleHost: pending.consoleHost,
            consolePort: pending.consolePort,
          }),
        );
      }
    });
    ws.addEventListener("message", (event) => {
      try {
        handleFrame(JSON.parse(String(event.data)));
      } catch {
        pushError("bad_json", "Could not parse bridge frame");
      }
    });
    ws.addEventListener("close", () => {
      setSocketOpen(false);
      wsRef.current = null;
      if (!intentionalClose.current && joinPayloadRef.current) {
        reconnectTimer.current = setTimeout(() => connectSocket(), 800);
      }
    });
    ws.addEventListener("error", () => {
      pushError("discover_failed", "WebSocket error");
    });
  }, [handleFrame, pushError, uid]);

  useEffect(() => {
    connectSocket();
    const onVisible = () => {
      if (document.visibilityState === "visible") connectSocket();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      intentionalClose.current = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connectSocket]);

  const send = useCallback((payload: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      pushError("not_connected", "WebSocket is not open");
      return;
    }
    ws.send(JSON.stringify(payload));
  }, [pushError]);
  sendRawRef.current = send;

  return {
    ready,
    socketOpen,
    status,
    connection,
    playerId,
    slotId,
    displayName,
    localAddress,
    decades,
    uid,
    joined,
    phase,
    avatars,
    selectedAvatarId,
    playerName,
    lastScreen,
    holdingText,
    holdingType,
    category,
    categoryOverride,
    trivia,
    powerPlay,
    linking,
    ordering,
    sorting,
    eliminating,
    missingLetter,
    matching,
    endFact,
    categoryChoiceEnabled,
    consoles,
    discovering,
    error,
    notice,
    colour,
    profileSubmitted,
    rejoining,
    clearError: () => setError(null),
    discover: () => {
      setDiscovering(true);
      setConsoles([]);
      send({ type: "bridge.discover" });
    },
    join: (input) => {
      setError(null);
      joinPayloadRef.current = input;
      setPhase("connect");
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        send({
          type: "bridge.join",
          code: input.code,
          uid,
          consoleHost: input.consoleHost,
          consolePort: input.consolePort,
        });
      } else {
        connectSocket();
      }
    },
    disconnect: () => {
      joinPayloadRef.current = null;
      send({ type: "bridge.disconnect" });
      setJoined(false);
      setConnection(null);
      setPhase("connect");
      setProfileSubmitted(false);
    },
    command: (message) => {
      if (message.TypeString === TypeString.ClientTriviaAnswer) {
        const currentId = activeTriviaId.current;
        const answerFor = typeof message._questionId === "string" ? message._questionId : currentId;
        if (answerFor && currentId && answerFor !== currentId) {
          setNotice("Ignored stale trivia answer after the next question started");
          return;
        }
        const { _questionId: _drop, ...wire } = message;
        send({ type: "bridge.command", message: wire });
        return;
      }
      if (message.TypeString === TypeString.ClientRequestAvatar && message.Request === true) {
        setSelectedAvatarId(typeof message.AvatarID === "string" ? message.AvatarID : null);
      }
      if (message.TypeString === TypeString.ClientCategorySelectOverride) {
        overrideSentRef.current = true;
      }
      send({ type: "bridge.command", message });
    },
    sendPortrait: (name, imageBase64) => {
      setPlayerName(name);
      send({ type: "bridge.portrait", playerName: name, imageBase64 });
      setProfileSubmitted(true);
      setPhase("lobby");
    },
    requestImage: (guid) => send({ type: "bridge.requestImage", guid }),
    setLocalPlayerName: (name) => setPlayerName(name),
    markProfileSubmitted: () => {
      setProfileSubmitted(true);
      setPhase("lobby");
    },
  };
}
