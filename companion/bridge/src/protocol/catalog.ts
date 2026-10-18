import { TypeString, type TypeStringValue } from "./messages.ts";

/**
 * Who originates the JSON on the wire, from send sites and decoded traces.
 * "server" includes messages whose TypeString starts with "Client" but that
 * the console sends to the phone (quiz commands, holding screen, game id).
 */
export type Origin = "client" | "server" | "client-observed-not-implemented";

export interface CatalogEntry {
  typeString: TypeStringValue;
  origin: Origin;
  /** Upstream behavior this entry is taken from. Paths are inside Reverse of Power. */
  source: string;
}

export const MESSAGE_CATALOG: readonly CatalogEntry[] = [
  { typeString: TypeString.InterfaceVersion, origin: "server", source: "GameProtocolClient.handleProtocolMessage" },
  { typeString: TypeString.SessionState, origin: "server", source: "GameProtocolClient.handleProtocolMessage" },
  { typeString: TypeString.ClientRequestPlayerID, origin: "client", source: "GameProtocolClient.handleProtocolMessage" },
  { typeString: TypeString.AssignPlayerIDAndSlot, origin: "server", source: "GameProtocolClient.handleProtocolMessage" },
  { typeString: TypeString.RejoiningClientOwnProfile, origin: "server", source: "NetworkManager.handleUIEvents; docs/reconnect-join-after-next-question-up-to-powerplay.txt" },
  { typeString: TypeString.ResourceRequirements, origin: "server", source: "GameProtocolClient.handleProtocolMessage" },
  { typeString: TypeString.RequestResource, origin: "client", source: "GameProtocolClient.handleProtocolMessage" },
  { typeString: TypeString.AllResourcesReceived, origin: "client", source: "GameProtocolClient.checkResourceComplete" },
  { typeString: TypeString.ClientQuizCommand, origin: "server", source: "NetworkManager.handleUIEvents; MainActivity; WaitingRoomFragment" },
  { typeString: TypeString.ClientRequestAvatarStatus, origin: "client", source: "GameProtocolClient.handleProtocolMessage" },
  { typeString: TypeString.ServerAvatarStatus, origin: "server", source: "NetworkManager.handleUIEvents" },
  { typeString: TypeString.ClientRequestAvatar, origin: "client", source: "NetworkManager.requestAvatar" },
  { typeString: TypeString.ServerAvatarRequestResponse, origin: "server", source: "NetworkManager.handleUIEvents" },
  { typeString: TypeString.ClientPlayerProfile, origin: "client", source: "NetworkManager.sendPlayerProfile / sendImageProfileImage" },
  { typeString: TypeString.DeviceInfo, origin: "client", source: "GameProtocolClient.handleProtocolMessage" },
  { typeString: TypeString.ClientImageResourceContentTransfer, origin: "client", source: "ProtocolEncoder.encodeImageTransfer" },
  { typeString: TypeString.ImageResourceContentTransfer, origin: "server", source: "GameProtocolClient.handleImageControl" },
  { typeString: TypeString.ClientGameID, origin: "server", source: "docs/fullgame.txt packet 0x14, direction S→C" },
  { typeString: TypeString.ClientHoldingScreenCommand, origin: "server", source: "NetworkManager.handleUIEvents; HoldingScreenFragment" },
  { typeString: TypeString.PlayerJoined, origin: "server", source: "ProtocolDecoder; docs/fullgame.txt S→C" },
  { typeString: TypeString.PlayerLeft, origin: "server", source: "ProtocolDecoder; no client send site" },
  { typeString: TypeString.PlayerNameQuizState, origin: "server", source: "ProtocolDecoder; docs/fullgame.txt S→C" },
  { typeString: TypeString.ServerColour, origin: "server", source: "NetworkManager.handleUIEvents" },
  { typeString: TypeString.StartGameButtonPressedResponse, origin: "client", source: "NetworkManager.sendStartGameButtonPressed" },
  { typeString: TypeString.ContinuePressedResponse, origin: "client", source: "NetworkManager.sendContinueButtonPressed" },
  { typeString: TypeString.ServerCategorySelectChoices, origin: "server", source: "NetworkManager.handleUIEvents; CategorySelectionFragment" },
  { typeString: TypeString.ServerRequestCategorySelectChoice, origin: "server", source: "NetworkManager.handleUIEvents" },
  { typeString: TypeString.ClientCategorySelectChoice, origin: "client", source: "NetworkManager.sendCategorySelection" },
  { typeString: TypeString.ServerBeginCategorySelectOverride, origin: "server", source: "NetworkManager.handleUIEvents" },
  { typeString: TypeString.ClientCategorySelectOverride, origin: "client", source: "NetworkManager.sendCategorySelectOverride" },
  { typeString: TypeString.ServerStopCategorySelectOverride, origin: "server", source: "NetworkManager.handleUIEvents" },
  { typeString: TypeString.ClientStopCategorySelectOverrideResponse, origin: "client", source: "NetworkManager.sendStopCategoryOverrideResponse" },
  { typeString: TypeString.ServerCategorySelectOverrideSuccess, origin: "server", source: "NetworkManager.handleUIEvents" },
  { typeString: TypeString.ServerBeginTriviaAnsweringPhase, origin: "server", source: "NetworkManager.handleUIEvents; TriviaAnsweringFragment" },
  { typeString: TypeString.ServerAwaitTriviaAnsweringPhase, origin: "server", source: "ProtocolDecoder; GameProtocol2Client.kt Decades notes" },
  { typeString: TypeString.ServerBeginLinkingAnsweringPhase, origin: "server", source: "NetworkManager.handleUIEvents" },
  { typeString: TypeString.ClientLinkingAnswer, origin: "client", source: "NetworkManager.sendLinkingAnswer" },
  { typeString: TypeString.ClientToServerOrderingAnswer, origin: "client", source: "NetworkManager.sendOrderingAnswer" },
  { typeString: TypeString.ServerBeginPowerPlayPhase, origin: "server", source: "NetworkManager.handleUIEvents; PowerPlayFragment" },
  { typeString: TypeString.ServerRequestPowerPlayChoice, origin: "server", source: "NetworkManager.handleUIEvents; PowerPlayFragment.onPowerPlayRequested" },
  { typeString: TypeString.ClientPowerPlayChoice, origin: "client", source: "NetworkManager.sendPowerPlayChoice" },
  { typeString: TypeString.ServerBeginSortingAnsweringPhase, origin: "server", source: "NetworkManager.handleUIEvents" },
  { typeString: TypeString.ServerBeginEliminatingAnsweringPhase, origin: "server", source: "NetworkManager.handleUIEvents" },
  { typeString: TypeString.ClientToServerEliminatingAnswer, origin: "client", source: "NetworkManager.sendEliminationAnswer" },
  { typeString: TypeString.ServerBeginMissingLetterAnsweringPhase, origin: "server", source: "NetworkManager.handleUIEvents" },
  { typeString: TypeString.PrototypeClientToServerMissingLetterAnswer, origin: "client", source: "NetworkManager.sendMissingLetterAnswer" },
  { typeString: TypeString.ServerBeginMatchingAnsweringPhase, origin: "server", source: "NetworkManager.handleUIEvents" },
  { typeString: TypeString.ClientToServerMatchingAnswer, origin: "client", source: "NetworkManager.sendMatchingAnswer" },
  { typeString: TypeString.ServerBeginOrderingAnsweringPhase, origin: "server", source: "NetworkManager.handleUIEvents" },
  { typeString: TypeString.ClientSortingAnswer, origin: "client", source: "NetworkManager.sendSortingAnswer" },
  { typeString: TypeString.ClientTriviaAnswer, origin: "client", source: "NetworkManager.sendTriviaAnswer; TriviaAnsweringFragment timer" },
  { typeString: TypeString.ServerRequestEndOfGameFactCount, origin: "server", source: "GameProtocolClient.handleProtocolMessage" },
  { typeString: TypeString.ClientEndOfGameFactCount, origin: "client", source: "GameProtocolClient.handleProtocolMessage FactCount=63" },
  { typeString: TypeString.ClientEndOfGameFactCommand, origin: "server", source: "NetworkManager.handleUIEvents" },
  { typeString: TypeString.ServerRoom, origin: "server", source: "ProtocolDecoder; GameProtocol2Client.kt Decades notes" },
  { typeString: TypeString.ClientToServerOngoingChallenge, origin: "client", source: "NetworkManager.sendOngoingChallengeUpdate" },
  { typeString: TypeString.ClientToServerTimeSync, origin: "client-observed-not-implemented", source: "docs/fullgame-decades.txt C→S; GameProtocolClient does not send it" },
  { typeString: TypeString.ServerToClientTimeSync, origin: "server", source: "GameProtocolClient.handleProtocolMessage logs only" },
];
