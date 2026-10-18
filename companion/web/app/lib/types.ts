/** Mirror of bridge `/api/status` and WebSocket envelopes the controller consumes. */

export interface BridgeStatusBody {
  service: string;
  gameplay: boolean;
  controllerUi?: boolean;
  protocol?: boolean;
  reason: string;
  httpPort: number;
  sessionPath: string;
  playlink: { bound: boolean; serverPort: number; clientListenPort: number };
  sessions?: { active: number; endpoints: number; free: number };
  reference: { repository: string; commit: string };
}

export type ConnectionState = "probing" | "handshaking" | "assigned" | "closed";

export interface ColorTint {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface WireMessage {
  TypeString: string;
  [key: string]: unknown;
}

export interface ConsoleInfo {
  host: string;
  hostId: string;
  hostName: string;
  hostType: string;
  awake: boolean;
  gamePort: number;
  hostRequestPort?: number;
}

export interface AvatarStatus {
  AvatarID: string;
  Available: boolean;
}

export interface TriviaAnswer {
  DisplayIndex: number;
  DisplayText: string;
  IsCorrect: boolean;
}

export interface PowerPlayPlayer {
  SlotIndex: number;
  Name: string;
  ImageGUID: string;
  Colour: ColorTint;
  Self: boolean;
  Away: boolean;
}

export interface ActivePowerPlay {
  PowerType: number;
  Count: number;
  Culprits: number[];
}

export interface CategoryChoice {
  DisplayText: string;
  Colour?: ColorTint;
  DoorIndex: number;
  ChoiceType: number;
}

export interface PowerPlayOption {
  DisplayIndex: number;
  PowerType: number;
  PowerTypes: number[];
  PowerTarget: number;
  PowerPlayTargets: number[];
  New: boolean;
  TargetCount: number;
}

export interface LinkingAnswer {
  DisplayText: string;
  AnswerID: string;
  MatchIndex: number;
  Direction: number;
}

export interface SortingAnswer {
  DisplayText: string;
  AnswerID: string;
  AnswerDirection: number;
}

export interface BridgeStateFrame {
  type: "bridge.state";
  connection: ConnectionState;
  playerId: number | null;
  slotId: number | null;
  displayName: string | null;
  decades: boolean;
  localAddress: string;
}

export interface BridgeSnapshotFrame {
  type: "bridge.snapshot";
  connection: ConnectionState;
  playerId: number | null;
  slotId: number | null;
  displayName: string | null;
  localAddress: string;
  decades: boolean;
  gameId: string | null;
  selectedAvatarId: string | null;
  playerName: string | null;
  avatars: WireMessage[];
  images: { guid: string; bytes: number }[];
  lastScreen: WireMessage | null;
}

export interface BridgeErrorFrame {
  type: "bridge.error";
  code: string;
  detail: string;
}

export const TypeString = {
  ClientQuizCommand: "ClientQuizCommandMessage",
  ClientHoldingScreen: "ClientHoldingScreenCommandMessage",
  ServerAvatarStatus: "KnowledgeIsPower.ServerAvatarStatusMessage",
  ServerAvatarRequestResponse: "KnowledgeIsPower.ServerAvatarRequestResponseMessage",
  ClientRequestAvatar: "KnowledgeIsPower.ClientRequestAvatarMessage",
  ClientPlayerProfile: "ClientPlayerProfileMessage",
  StartGame: "StartGameButtonPressedResponseMessage",
  Continue: "ContinuePressedResponseMessage",
  ServerCategorySelectChoices: "KnowledgeIsPower.ServerCategorySelectChoices",
  ServerRequestCategorySelectChoice: "KnowledgeIsPower.ServerRequestCategorySelectChoice",
  ClientCategorySelectChoice: "KnowledgeIsPower.ClientCategorySelectChoice",
  ServerBeginCategorySelectOverride: "KnowledgeIsPower.ServerBeginCategorySelectOverride",
  ClientCategorySelectOverride: "KnowledgeIsPower.ClientCategorySelectOverride",
  ServerStopCategorySelectOverride: "KnowledgeIsPower.ServerStopCategorySelectOverride",
  ClientStopCategorySelectOverrideResponse: "KnowledgeIsPower.ClientStopCategorySelectOverrideResponse",
  ServerCategorySelectOverrideSuccess: "KnowledgeIsPower.ServerCategorySelectOverrideSuccess",
  ServerBeginTrivia: "KnowledgeIsPower.ServerBeginTriviaAnsweringPhase",
  ServerBeginPowerPlay: "KnowledgeIsPower.ServerBeginPowerPlayPhase",
  ServerRequestPowerPlayChoice: "KnowledgeIsPower.ServerRequestPowerPlayChoice",
  ClientTriviaAnswer: "KnowledgeIsPower.ClientTriviaAnswer",
  ClientPowerPlayChoice: "KnowledgeIsPower.ClientPowerPlayChoice",
  ServerBeginLinking: "KnowledgeIsPower.ServerBeginLinkingAnsweringPhase",
  ClientLinkingAnswer: "KnowledgeIsPower.ClientLinkingAnswer",
  ServerBeginOrdering: "KnowledgeIsPower.ServerBeginOrderingAnsweringPhase",
  ClientOrderingAnswer: "KnowledgeIsPower.ClientToServerOrderingAnswer",
  ServerBeginSorting: "KnowledgeIsPower.ServerBeginSortingAnsweringPhase",
  ClientSortingAnswer: "KnowledgeIsPower.ClientSortingAnswer",
  ServerBeginEliminating: "KnowledgeIsPower.ServerBeginEliminatingAnsweringPhase",
  ClientEliminatingAnswer: "KnowledgeIsPower.ClientToServerEliminatingAnswer",
  ServerBeginMissingLetter: "KnowledgeIsPower.ServerBeginMissingLetterAnsweringPhase",
  ClientMissingLetterAnswer: "KnowledgeIsPower.PrototypeClientToServerMissingLetterAnswer",
  ServerBeginMatching: "KnowledgeIsPower.ServerBeginMatchingAnsweringPhase",
  ClientMatchingAnswer: "KnowledgeIsPower.ClientToServerMatchingAnswer",
  ClientOngoingChallenge: "KnowledgeIsPower.ClientToServerOngoingChallengeMessage",
  ClientEndOfGameFact: "ClientEndOfGameFactCommandMessage",
  RejoiningProfile: "RejoiningClientOwnProfileMessage",
  ServerColour: "KnowledgeIsPower.ServerColourMessage",
  PlayerJoined: "PlayerJoinedMessage",
  PlayerLeft: "PlayerLeftMessage",
} as const;

export const QUIZ_ACTION = {
  CONTINUE: 4,
  READY: 14,
  EXIT: 15,
  PAUSED: 29,
  UNPAUSED: 30,
  RESET_TO_NAME: 31,
} as const;

export const POWER_TYPE_LABELS: Record<number, string> = {
  1: "Bet",
  4: "Freeze",
  5: "Bombles",
  6: "Nibblers",
  7: "Gloop",
  8: "Points Party",
  10: "Double Trouble",
  11: "Double Trouble",
  12: "Double Trouble",
  20: "Lockdown",
  22: "Zippers",
  24: "Bug",
  25: "Points Doubler",
  26: "Fifty Fifty",
  28: "Letter Scatter",
  29: "Disco Inferno",
};

export type ScreenKind =
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
  | "endFact"
  | "unsupported";

export function errorHint(code: string): string {
  const hints: Record<string, string> = {
    bad_join_code: "Join code does not match the running bridge.",
    bad_uid: "Device id must be 32 hex characters.",
    bad_console_address: "Console address must be a private IPv4 address.",
    not_private_network: "This page can only talk to a LAN bridge.",
    no_lan_address: "Bridge has no usable LAN address.",
    endpoint_exhausted: "Every bridge IP already has a player. Add another host address for a second phone.",
    udp_bind_failed: "UDP 9060 is already taken on that address.",
    connect_timeout: "Console did not complete the handshake.",
    not_connected: "Wait until the console acknowledges the session.",
    ack_timeout: "Console did not acknowledge a command. Session stays up; command was not resent.",
    nack: "Console sent a NACK. Session stays up; command was not resent.",
    avatar_required: "Select an avatar before sending a portrait.",
    not_jpeg: "Portrait must be a JPEG.",
    image_too_large: "Portrait is too large (max 400 KB).",
    session_conflict: "This device id is already on a different console.",
    already_joined: "This socket already joined.",
    discover_failed: "Discovery failed.",
    encode_error: "Command fields did not match the protocol schema.",
    unknown_type: "Unknown message type.",
    server_message: "Cannot send a console-originated message type.",
  };
  return hints[code] ?? code;
}
