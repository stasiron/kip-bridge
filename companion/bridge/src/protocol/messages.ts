/**
 * Wire `TypeString` values from `GameMessages.kt` at the pinned commit.
 * Do not add a type that is not declared there.
 */
export const TypeString = {
  InterfaceVersion: "InterfaceVersionMessage",
  SessionState: "SessionStateMessage",
  ClientRequestPlayerID: "ClientRequestPlayerIDMessage",
  AssignPlayerIDAndSlot: "AssignPlayerIDAndSlotMessage",
  RejoiningClientOwnProfile: "RejoiningClientOwnProfileMessage",
  ResourceRequirements: "ResourceRequirementsMessage",
  RequestResource: "RequestResourceMessage",
  AllResourcesReceived: "AllResourcesReceivedMessage",
  ClientQuizCommand: "ClientQuizCommandMessage",
  ClientRequestAvatarStatus: "KnowledgeIsPower.ClientRequestAvatarStatusMessage",
  ServerAvatarStatus: "KnowledgeIsPower.ServerAvatarStatusMessage",
  ClientRequestAvatar: "KnowledgeIsPower.ClientRequestAvatarMessage",
  ServerAvatarRequestResponse: "KnowledgeIsPower.ServerAvatarRequestResponseMessage",
  ClientPlayerProfile: "ClientPlayerProfileMessage",
  DeviceInfo: "DeviceInfoMessage",
  ClientImageResourceContentTransfer: "ClientImageResourceContentTransferMessage",
  ImageResourceContentTransfer: "ImageResourceContentTransferMessage",
  ClientGameID: "ClientGameIDMessage",
  ClientHoldingScreenCommand: "ClientHoldingScreenCommandMessage",
  PlayerJoined: "PlayerJoinedMessage",
  PlayerLeft: "PlayerLeftMessage",
  PlayerNameQuizState: "PlayerNameQuizStateMessage",
  ServerColour: "KnowledgeIsPower.ServerColourMessage",
  StartGameButtonPressedResponse: "StartGameButtonPressedResponseMessage",
  ContinuePressedResponse: "ContinuePressedResponseMessage",
  ServerCategorySelectChoices: "KnowledgeIsPower.ServerCategorySelectChoices",
  ServerRequestCategorySelectChoice: "KnowledgeIsPower.ServerRequestCategorySelectChoice",
  ClientCategorySelectChoice: "KnowledgeIsPower.ClientCategorySelectChoice",
  ServerBeginCategorySelectOverride: "KnowledgeIsPower.ServerBeginCategorySelectOverride",
  ClientCategorySelectOverride: "KnowledgeIsPower.ClientCategorySelectOverride",
  ServerStopCategorySelectOverride: "KnowledgeIsPower.ServerStopCategorySelectOverride",
  ClientStopCategorySelectOverrideResponse: "KnowledgeIsPower.ClientStopCategorySelectOverrideResponse",
  ServerCategorySelectOverrideSuccess: "KnowledgeIsPower.ServerCategorySelectOverrideSuccess",
  ServerBeginTriviaAnsweringPhase: "KnowledgeIsPower.ServerBeginTriviaAnsweringPhase",
  ServerAwaitTriviaAnsweringPhase: "KnowledgeIsPower.ServerAwaitTriviaAnsweringPhaseMessage",
  ServerBeginLinkingAnsweringPhase: "KnowledgeIsPower.ServerBeginLinkingAnsweringPhase",
  ClientLinkingAnswer: "KnowledgeIsPower.ClientLinkingAnswer",
  ClientToServerOrderingAnswer: "KnowledgeIsPower.ClientToServerOrderingAnswer",
  ServerBeginPowerPlayPhase: "KnowledgeIsPower.ServerBeginPowerPlayPhase",
  ServerRequestPowerPlayChoice: "KnowledgeIsPower.ServerRequestPowerPlayChoice",
  ClientPowerPlayChoice: "KnowledgeIsPower.ClientPowerPlayChoice",
  ServerBeginSortingAnsweringPhase: "KnowledgeIsPower.ServerBeginSortingAnsweringPhase",
  ServerBeginEliminatingAnsweringPhase: "KnowledgeIsPower.ServerBeginEliminatingAnsweringPhase",
  ClientToServerEliminatingAnswer: "KnowledgeIsPower.ClientToServerEliminatingAnswer",
  ServerBeginMissingLetterAnsweringPhase: "KnowledgeIsPower.ServerBeginMissingLetterAnsweringPhase",
  PrototypeClientToServerMissingLetterAnswer: "KnowledgeIsPower.PrototypeClientToServerMissingLetterAnswer",
  ServerBeginMatchingAnsweringPhase: "KnowledgeIsPower.ServerBeginMatchingAnsweringPhase",
  ClientToServerMatchingAnswer: "KnowledgeIsPower.ClientToServerMatchingAnswer",
  ServerBeginOrderingAnsweringPhase: "KnowledgeIsPower.ServerBeginOrderingAnsweringPhase",
  ClientSortingAnswer: "KnowledgeIsPower.ClientSortingAnswer",
  ClientTriviaAnswer: "KnowledgeIsPower.ClientTriviaAnswer",
  ServerRequestEndOfGameFactCount: "KnowledgeIsPower.ServerRequestEndOfGameFactCount",
  ClientEndOfGameFactCount: "KnowledgeIsPower.ClientEndOfGameFactCount",
  ClientEndOfGameFactCommand: "ClientEndOfGameFactCommandMessage",
  ServerRoom: "KnowledgeIsPower.ServerRoomMessage",
  ClientToServerOngoingChallenge: "KnowledgeIsPower.ClientToServerOngoingChallengeMessage",
  ClientToServerTimeSync: "KnowledgeIsPower.ClientToServerTimeSyncMessage",
  ServerToClientTimeSync: "KnowledgeIsPower.ServerToClientTimeSyncMessage",
} as const;

export type TypeStringValue = (typeof TypeString)[keyof typeof TypeString];

/** `PowerType` integer values from `GameMessages.kt`. Unknown ints are not given names here. */
export const POWER_TYPE_VALUES = {
  BET: 1,
  FREEZE: 4,
  BOMBLES: 5,
  NIBBLERS: 6,
  GLOOP: 7,
  POINTS_PARTY: 8,
  DOUBLE_TROUBLE_FREEZE_GLOOP: 10,
  DOUBLE_TROUBLE_FREEZE_BOMBLES: 11,
  DOUBLE_TROUBLE_NIBBLERS_GLOOP: 12,
  LOCKDOWN: 20,
  ZIPPERS: 22,
  BUG: 24,
  POINTS_DOUBLER: 25,
  FIFTY_FIFTY: 26,
  LETTER_SCATTER: 28,
  DISCO_INFERNO: 29,
  NONE: -1,
} as const;

/** Quiz `action` values from `ClientQuizCommandMessage` companion constants. */
export const QUIZ_ACTION = {
  CONTINUE: 4,
  READY: 14,
  EXIT: 15,
  PAUSED: 29,
  UNPAUSED: 30,
  RESET_TO_NAME: 31,
} as const;

export interface ColorTint {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface ResourceRequirement {
  GUID: string;
  Rqrmnt: number;
}

export interface InterfaceVersionMessage {
  TypeString: typeof TypeString.InterfaceVersion;
  InterfaceVersion: string;
}

export interface SessionStateMessage {
  TypeString: typeof TypeString.SessionState;
  SessionID: number;
}

export interface ClientRequestPlayerIDMessage {
  TypeString: typeof TypeString.ClientRequestPlayerID;
  UID: string;
}

export interface AssignPlayerIDAndSlotMessage {
  TypeString: typeof TypeString.AssignPlayerIDAndSlot;
  PlayerID: number;
  SlotID: number;
  UDPPortOffset: number;
  DisplayName: string;
  PSNID: string;
}

export interface RejoiningClientOwnProfileMessage {
  TypeString: typeof TypeString.RejoiningClientOwnProfile;
  Name: string;
  PortraitGUID: string;
  Colour: ColorTint;
  AvatarID: string;
}

export interface ResourceRequirementsMessage {
  TypeString: typeof TypeString.ResourceRequirements;
  Requirements: ResourceRequirement[];
}

export interface RequestResourceMessage {
  TypeString: typeof TypeString.RequestResource;
  ResourceGUID: string;
}

export interface AllResourcesReceivedMessage {
  TypeString: typeof TypeString.AllResourcesReceived;
  Requirements: ResourceRequirement[];
}

export interface ClientQuizCommandMessage {
  TypeString: typeof TypeString.ClientQuizCommand;
  action: number;
  time: number;
}

export interface ClientRequestAvatarStatusMessage {
  TypeString: typeof TypeString.ClientRequestAvatarStatus;
}

export interface ServerAvatarStatusMessage {
  TypeString: typeof TypeString.ServerAvatarStatus;
  AvatarID: string;
  Available: boolean;
}

export interface ClientRequestAvatarMessage {
  TypeString: typeof TypeString.ClientRequestAvatar;
  RequestID: string;
  AvatarID: string;
  Request: boolean;
}

export interface ServerAvatarRequestResponseMessage {
  TypeString: typeof TypeString.ServerAvatarRequestResponse;
  RequestID: string;
  AvatarID: string;
  Available: boolean;
}

export interface ClientPlayerProfileMessage {
  TypeString: typeof TypeString.ClientPlayerProfile;
  playerName: string;
  uppercasePlayerName: string;
  deviceCultureName: string;
  playerCardId: string;
}

export interface DeviceInfoMessage {
  TypeString: typeof TypeString.DeviceInfo;
  Response: number;
  DeviceSize: number;
  DeviceOS: number;
  DeviceModel: string;
  DeviceType: string;
  DeviceUID: string;
  DeviceOperatingSystem: string;
}

export interface ClientImageResourceContentTransferMessage {
  TypeString: typeof TypeString.ClientImageResourceContentTransfer;
  TransferID: number;
  ImageGUID: string;
  ImgType: number;
}

export interface ImageResourceContentTransferMessage {
  TypeString: typeof TypeString.ImageResourceContentTransfer;
  TransferID: number;
  ImageGUID: string;
  Acknowledge: boolean;
}

export interface ClientGameIDMessage {
  TypeString: typeof TypeString.ClientGameID;
  GameID: string;
}

export interface ClientHoldingScreenCommandMessage {
  TypeString: typeof TypeString.ClientHoldingScreenCommand;
  action: number;
  time: number;
  HoldingScreenText: string;
  HoldingScreenType: number;
  OtherPlayerIndex: number;
  ShowPortraitPhotoControls: boolean;
  serverTick: number;
}

export interface PlayerJoinedMessage {
  TypeString: typeof TypeString.PlayerJoined;
  CurrentPlayerID: number;
  OldPlayerID: number;
  SlotID: number;
}

export interface PlayerLeftMessage {
  TypeString: typeof TypeString.PlayerLeft;
  PlayerID: number;
}

export interface PlayerNameQuizStateMessage {
  TypeString: typeof TypeString.PlayerNameQuizState;
  PlayerName: string;
  PlayerID: number;
}

export interface ServerColourMessage {
  TypeString: typeof TypeString.ServerColour;
  BackgroundTint: ColorTint;
  PrimaryTint: ColorTint;
  SecondaryTint: ColorTint;
  Rainbow: boolean;
  RoundType: number;
}

export interface StartGameButtonPressedResponseMessage {
  TypeString: typeof TypeString.StartGameButtonPressedResponse;
  Response: number;
}

export interface ContinuePressedResponseMessage {
  TypeString: typeof TypeString.ContinuePressedResponse;
  Response: number;
}

export interface CategoryChoice {
  DisplayText: string;
  Colour?: ColorTint;
  DoorIndex: number;
  ChoiceType: number;
}

export interface ServerCategorySelectChoices {
  TypeString: typeof TypeString.ServerCategorySelectChoices;
  CategoryChoices: CategoryChoice[];
  HeaderText: string;
  BackgroundTint?: ColorTint;
  PrimaryTint?: ColorTint;
  SecondaryTint?: ColorTint;
}

export interface ServerRequestCategorySelectChoice {
  TypeString: typeof TypeString.ServerRequestCategorySelectChoice;
}

export interface ClientCategorySelectChoice {
  TypeString: typeof TypeString.ClientCategorySelectChoice;
  ChosenCategoryIndex: number;
}

export interface ServerBeginCategorySelectOverride {
  TypeString: typeof TypeString.ServerBeginCategorySelectOverride;
  DurationSeconds: number;
  InitialCategorySelectChoice: string;
  DoorIndex: number;
}

export interface ClientCategorySelectOverride {
  TypeString: typeof TypeString.ClientCategorySelectOverride;
  DurationSeconds: number;
}

export interface ServerStopCategorySelectOverride {
  TypeString: typeof TypeString.ServerStopCategorySelectOverride;
}

export interface ClientStopCategorySelectOverrideResponse {
  TypeString: typeof TypeString.ClientStopCategorySelectOverrideResponse;
  OverrideSent: boolean;
}

export interface ServerCategorySelectOverrideSuccess {
  TypeString: typeof TypeString.ServerCategorySelectOverrideSuccess;
  CategorySelectOverrideSuccess: boolean;
  CategorySelectOverridePlayerName: string;
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

export interface ServerBeginTriviaAnsweringPhase {
  TypeString: typeof TypeString.ServerBeginTriviaAnsweringPhase;
  QuestionID: string;
  QuestionText: string;
  QuestionDuration: number;
  Answers: TriviaAnswer[];
  PowerPlays: ActivePowerPlay[];
  PowerPlayPlayers: PowerPlayPlayer[];
  RoundType: number;
  BackgroundTint?: ColorTint;
  PrimaryTint?: ColorTint;
  SecondaryTint?: ColorTint;
  serverTick: number;
}

export interface ServerAwaitTriviaAnsweringPhaseMessage {
  TypeString: typeof TypeString.ServerAwaitTriviaAnsweringPhase;
  PowerPlays: ActivePowerPlay[];
}

export interface LinkingAnswer {
  DisplayText: string;
  AnswerID: string;
  MatchIndex: number;
  Direction: number;
}

export interface ServerBeginLinkingAnsweringPhase {
  TypeString: typeof TypeString.ServerBeginLinkingAnsweringPhase;
  QuestionID: string;
  QuestionText: string;
  QuestionDuration: number;
  LinkingAnswers: LinkingAnswer[];
}

export interface ClientLinkingAnswerEntry {
  FromID: string;
  ToID: string;
  Correct: boolean;
}

export interface ClientLinkingAnswer {
  TypeString: typeof TypeString.ClientLinkingAnswer;
  ClientLinkingCorrectAnswerCount: number;
  ClientAnswers: ClientLinkingAnswerEntry[];
}

export interface ClientToServerOrderingAnswer {
  TypeString: typeof TypeString.ClientToServerOrderingAnswer;
  ClientOrderingCorrectAnswerCount: number;
}

export interface PowerPlay {
  DisplayIndex: number;
  PowerType: number;
  PowerTypes: number[];
  PowerTarget: number;
  PowerPlayTargets: number[];
  New: boolean;
  TargetCount: number;
}

export interface ServerBeginPowerPlayPhase {
  TypeString: typeof TypeString.ServerBeginPowerPlayPhase;
  PowerPlays: PowerPlay[];
  PowerPlayPlayers: PowerPlayPlayer[];
  RoundType: number;
}

export interface ServerRequestPowerPlayChoice {
  TypeString: typeof TypeString.ServerRequestPowerPlayChoice;
}

export interface ClientPowerPlayChoice {
  TypeString: typeof TypeString.ClientPowerPlayChoice;
  PowerPlaySlotIndex: number;
  TargetSlotIndex: number[];
}

export interface SortingAnswer {
  DisplayText: string;
  AnswerID: string;
  AnswerDirection: number;
}

export interface ServerBeginSortingAnsweringPhase {
  TypeString: typeof TypeString.ServerBeginSortingAnsweringPhase;
  QuestionID: string;
  QuestionText: string;
  LeftBucketLabel: string;
  LeftBucketID: string;
  RightBucketLabel: string;
  RightBucketID: string;
  QuestionDuration: number;
  SortingAnswers: SortingAnswer[];
}

export interface EliminatingAnswerData {
  CorrectInfo: string;
  IncorrectInfo: string;
  CorrectAnswer: string;
  IncorrectAnswers: string[];
}

export interface ServerBeginEliminatingAnsweringPhase {
  TypeString: typeof TypeString.ServerBeginEliminatingAnsweringPhase;
  ChallengeId: string;
  QuestionText: string;
  QuestionDuration: number;
  EliminatingAnswerData: EliminatingAnswerData[];
  serverTick: number;
}

export interface ClientToServerEliminatingAnswer {
  TypeString: typeof TypeString.ClientToServerEliminatingAnswer;
  AnswerCount: number;
}

export interface MissingLetterAnswerData {
  answerInfo: string;
  correct: string;
  letters: string;
  finalDisplay: string;
}

export interface ServerBeginMissingLetterAnsweringPhase {
  TypeString: typeof TypeString.ServerBeginMissingLetterAnsweringPhase;
  ChallengeId: string;
  Question: string;
  QuestionDuration: number;
  MissingLetterAnswerData: MissingLetterAnswerData[];
  serverTick: number;
}

export interface PrototypeClientToServerMissingLetterAnswer {
  TypeString: typeof TypeString.PrototypeClientToServerMissingLetterAnswer;
  ClientMissingLetterCorrectAnswerCount: number;
}

export interface MatchingData {
  QuestionText: string;
  AnswerText: string;
}

export interface ServerBeginMatchingAnsweringPhase {
  TypeString: typeof TypeString.ServerBeginMatchingAnsweringPhase;
  ChallengeId: string;
  QuestionDuration: number;
  MatchingData: MatchingData[];
  DummyAnswerData: string[];
  serverTick: number;
}

export interface ClientToServerMatchingAnswer {
  TypeString: typeof TypeString.ClientToServerMatchingAnswer;
  ClientMatchingCorrectAnswerCount: number;
}

export interface OrderingAnswerData {
  WordsInCorrectOrder: string[];
  LayoutId: number;
}

export interface ServerBeginOrderingAnsweringPhase {
  TypeString: typeof TypeString.ServerBeginOrderingAnsweringPhase;
  ChallengeId: string;
  QuestionText: string;
  QuestionDuration: number;
  OrderingAnswerData: OrderingAnswerData[];
  serverTick: number;
}

export interface ClientSortingAnswerEntry {
  AnswerID: string;
  AnswerBucketID: string;
  Correct: boolean;
}

export interface ClientSortingAnswer {
  TypeString: typeof TypeString.ClientSortingAnswer;
  ClientSortingCorrectAnswerCount: number;
  SortingAnswers: ClientSortingAnswerEntry[];
}

export interface ClientTriviaAnswer {
  TypeString: typeof TypeString.ClientTriviaAnswer;
  ChosenAnswerDisplayIndex: number;
  AnswerTime: number;
  NumBombsExploded: number;
  PaintCleared: boolean;
  IceCleared: boolean;
  NumWrongAnswers: number;
  TotalPaintLayersPerAnswer: number;
  PaintLayersClearedAnswer0: number;
  PaintLayersClearedAnswer1: number;
  PaintLayersClearedAnswer2: number;
  PaintLayersClearedAnswer3: number;
  TotalIceLayersPerAnswer: number;
  IceLayersClearedAnswer0: number;
  IceLayersClearedAnswer1: number;
  IceLayersClearedAnswer2: number;
  IceLayersClearedAnswer3: number;
}

export interface ServerRequestEndOfGameFactCount {
  TypeString: typeof TypeString.ServerRequestEndOfGameFactCount;
}

export interface ClientEndOfGameFactCount {
  TypeString: typeof TypeString.ClientEndOfGameFactCount;
  FactCount: number;
}

export interface ClientEndOfGameFactCommandMessage {
  TypeString: typeof TypeString.ClientEndOfGameFactCommand;
  action: number;
  time: number;
  FactNumber: number;
}

export interface ServerRoomMessage {
  TypeString: typeof TypeString.ServerRoom;
  Room: number;
  RoundType: number;
}

export interface ClientToServerOngoingChallengeMessage {
  TypeString: typeof TypeString.ClientToServerOngoingChallenge;
  CorrectAnswerCount: number;
}

export interface ClientToServerTimeSyncMessage {
  TypeString: typeof TypeString.ClientToServerTimeSync;
  sentTick: number;
}

export interface ServerToClientTimeSyncMessage {
  TypeString: typeof TypeString.ServerToClientTimeSync;
  clientSentTick: number;
  serverSentTick: number;
}
