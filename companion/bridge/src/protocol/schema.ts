/**
 * JSON field order from `GameMessages.kt` declaration order.
 * Doubles are marked `d` because kotlinx writes `0.0`, not `0`.
 * A leading `?` means the Kotlin property is nullable or has a default the wire may omit on decode.
 * Encoding omits a field only when the value is `undefined`.
 */

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

type Kind = "s" | "i" | "d" | "b" | "color" | "obj" | "arr";

interface Field {
  name: string;
  kind: Kind;
  optional: boolean;
  fields?: Field[];
  element?: Field;
}

function field(name: string, kind: Kind, extra?: Partial<Field>): Field {
  return { kind, optional: name.startsWith("?"), ...extra, name: name.replace(/^\?/, "") };
}

const color: Field = {
  name: "color",
  kind: "obj",
  optional: false,
  fields: [field("r", "d"), field("g", "d"), field("b", "d"), field("a", "d")],
};

function obj(name: string, fields: Field[], optional = false): Field {
  return { name: name.replace(/^\?/, ""), kind: "obj", optional: optional || name.startsWith("?"), fields };
}

function arr(name: string, element: Field, optional = false): Field {
  return { name: name.replace(/^\?/, ""), kind: "arr", optional: optional || name.startsWith("?"), element };
}

const requirement = obj("requirement", [field("GUID", "s"), field("Rqrmnt", "i")]);
const categoryChoice = obj("choice", [
  field("DisplayText", "s"),
  obj("?Colour", color.fields ?? []),
  field("DoorIndex", "i"),
  field("ChoiceType", "i"),
]);
const triviaAnswer = obj("answer", [
  field("DisplayIndex", "i"),
  field("DisplayText", "s"),
  field("IsCorrect", "b"),
]);
const powerPlayer = obj("player", [
  field("SlotIndex", "i"),
  field("Name", "s"),
  field("ImageGUID", "s"),
  obj("Colour", color.fields ?? []),
  field("Self", "b"),
  field("Away", "b"),
]);
const activePower = obj("power", [
  field("PowerType", "i"),
  field("Count", "i"),
  arr("?Culprits", field("slot", "i")),
]);
const linkingAnswer = obj("link", [
  field("DisplayText", "s"),
  field("AnswerID", "s"),
  field("MatchIndex", "i"),
  field("Direction", "i"),
]);
const linkingEntry = obj("entry", [field("FromID", "s"), field("ToID", "s"), field("Correct", "b")]);
const powerPlay = obj("play", [
  field("DisplayIndex", "i"),
  field("PowerType", "i"),
  arr("PowerTypes", field("type", "i")),
  field("PowerTarget", "i"),
  arr("PowerPlayTargets", field("slot", "i")),
  field("New", "b"),
  field("TargetCount", "i"),
]);
const sortingAnswer = obj("sort", [
  field("DisplayText", "s"),
  field("AnswerID", "s"),
  field("AnswerDirection", "i"),
]);
const sortingEntry = obj("entry", [
  field("AnswerID", "s"),
  field("AnswerBucketID", "s"),
  field("Correct", "b"),
]);
const eliminating = obj("row", [
  field("CorrectInfo", "s"),
  field("IncorrectInfo", "s"),
  field("CorrectAnswer", "s"),
  arr("IncorrectAnswers", field("text", "s")),
]);
const missingLetter = obj("row", [
  field("answerInfo", "s"),
  field("correct", "s"),
  field("letters", "s"),
  field("finalDisplay", "s"),
]);
const matching = obj("row", [field("QuestionText", "s"), field("AnswerText", "s")]);
const ordering = obj("row", [arr("WordsInCorrectOrder", field("word", "s")), field("LayoutId", "i")]);

function message(fields: Field[]): Field[] {
  return [field("TypeString", "s"), ...fields];
}

export const MESSAGE_FIELDS: Record<string, Field[]> = {
  InterfaceVersionMessage: message([field("InterfaceVersion", "s")]),
  SessionStateMessage: message([field("SessionID", "i")]),
  ClientRequestPlayerIDMessage: message([field("UID", "s")]),
  AssignPlayerIDAndSlotMessage: message([
    field("PlayerID", "i"),
    field("SlotID", "i"),
    field("UDPPortOffset", "i"),
    field("DisplayName", "s"),
    field("PSNID", "s"),
  ]),
  RejoiningClientOwnProfileMessage: message([
    field("Name", "s"),
    field("PortraitGUID", "s"),
    obj("Colour", color.fields ?? []),
    field("AvatarID", "s"),
  ]),
  ResourceRequirementsMessage: message([arr("Requirements", requirement)]),
  RequestResourceMessage: message([field("ResourceGUID", "s")]),
  AllResourcesReceivedMessage: message([arr("Requirements", requirement)]),
  ClientQuizCommandMessage: message([field("action", "i"), field("time", "d")]),
  "KnowledgeIsPower.ClientRequestAvatarStatusMessage": message([]),
  "KnowledgeIsPower.ServerAvatarStatusMessage": message([field("AvatarID", "s"), field("Available", "b")]),
  "KnowledgeIsPower.ClientRequestAvatarMessage": message([
    field("RequestID", "s"),
    field("AvatarID", "s"),
    field("Request", "b"),
  ]),
  "KnowledgeIsPower.ServerAvatarRequestResponseMessage": message([
    field("RequestID", "s"),
    field("AvatarID", "s"),
    field("Available", "b"),
  ]),
  ClientPlayerProfileMessage: message([
    field("playerName", "s"),
    field("uppercasePlayerName", "s"),
    field("deviceCultureName", "s"),
    field("playerCardId", "s"),
  ]),
  DeviceInfoMessage: message([
    field("Response", "i"),
    field("DeviceSize", "i"),
    field("DeviceOS", "i"),
    field("DeviceModel", "s"),
    field("DeviceType", "s"),
    field("DeviceUID", "s"),
    field("DeviceOperatingSystem", "s"),
  ]),
  ClientImageResourceContentTransferMessage: message([
    field("TransferID", "i"),
    field("ImageGUID", "s"),
    field("ImgType", "i"),
  ]),
  ImageResourceContentTransferMessage: message([
    field("TransferID", "i"),
    field("ImageGUID", "s"),
    field("Acknowledge", "b"),
  ]),
  ClientGameIDMessage: message([field("GameID", "s")]),
  ClientHoldingScreenCommandMessage: message([
    field("action", "i"),
    field("time", "d"),
    field("HoldingScreenText", "s"),
    field("HoldingScreenType", "i"),
    field("OtherPlayerIndex", "i"),
    field("ShowPortraitPhotoControls", "b"),
    field("?serverTick", "i"),
  ]),
  PlayerJoinedMessage: message([field("CurrentPlayerID", "i"), field("OldPlayerID", "i"), field("SlotID", "i")]),
  PlayerLeftMessage: message([field("PlayerID", "i")]),
  PlayerNameQuizStateMessage: message([field("PlayerName", "s"), field("PlayerID", "i")]),
  "KnowledgeIsPower.ServerColourMessage": message([
    obj("BackgroundTint", color.fields ?? []),
    obj("PrimaryTint", color.fields ?? []),
    obj("SecondaryTint", color.fields ?? []),
    field("Rainbow", "b"),
    field("?RoundType", "i"),
  ]),
  StartGameButtonPressedResponseMessage: message([field("Response", "i")]),
  ContinuePressedResponseMessage: message([field("Response", "i")]),
  "KnowledgeIsPower.ServerCategorySelectChoices": message([
    arr("CategoryChoices", categoryChoice),
    field("?HeaderText", "s"),
    obj("?BackgroundTint", color.fields ?? []),
    obj("?PrimaryTint", color.fields ?? []),
    obj("?SecondaryTint", color.fields ?? []),
  ]),
  "KnowledgeIsPower.ServerRequestCategorySelectChoice": message([]),
  "KnowledgeIsPower.ClientCategorySelectChoice": message([field("ChosenCategoryIndex", "i")]),
  "KnowledgeIsPower.ServerBeginCategorySelectOverride": message([
    field("DurationSeconds", "d"),
    field("InitialCategorySelectChoice", "s"),
    field("DoorIndex", "i"),
  ]),
  "KnowledgeIsPower.ClientCategorySelectOverride": message([field("DurationSeconds", "d")]),
  "KnowledgeIsPower.ServerStopCategorySelectOverride": message([]),
  "KnowledgeIsPower.ClientStopCategorySelectOverrideResponse": message([field("OverrideSent", "b")]),
  "KnowledgeIsPower.ServerCategorySelectOverrideSuccess": message([
    field("CategorySelectOverrideSuccess", "b"),
    field("CategorySelectOverridePlayerName", "s"),
  ]),
  "KnowledgeIsPower.ServerBeginTriviaAnsweringPhase": message([
    field("QuestionID", "s"),
    field("QuestionText", "s"),
    field("QuestionDuration", "d"),
    arr("Answers", triviaAnswer),
    arr("PowerPlays", activePower),
    arr("PowerPlayPlayers", powerPlayer),
    field("RoundType", "i"),
    obj("?BackgroundTint", color.fields ?? []),
    obj("?PrimaryTint", color.fields ?? []),
    obj("?SecondaryTint", color.fields ?? []),
    field("?serverTick", "i"),
  ]),
  "KnowledgeIsPower.ServerAwaitTriviaAnsweringPhaseMessage": message([arr("?PowerPlays", activePower)]),
  "KnowledgeIsPower.ServerBeginLinkingAnsweringPhase": message([
    field("QuestionID", "s"),
    field("QuestionText", "s"),
    field("QuestionDuration", "d"),
    arr("LinkingAnswers", linkingAnswer),
  ]),
  "KnowledgeIsPower.ClientLinkingAnswer": message([
    field("ClientLinkingCorrectAnswerCount", "i"),
    arr("ClientAnswers", linkingEntry),
  ]),
  "KnowledgeIsPower.ClientToServerOrderingAnswer": message([field("ClientOrderingCorrectAnswerCount", "i")]),
  "KnowledgeIsPower.ServerBeginPowerPlayPhase": message([
    arr("PowerPlays", powerPlay),
    arr("PowerPlayPlayers", powerPlayer),
    field("RoundType", "i"),
  ]),
  "KnowledgeIsPower.ServerRequestPowerPlayChoice": message([]),
  "KnowledgeIsPower.ClientPowerPlayChoice": message([
    field("PowerPlaySlotIndex", "i"),
    arr("TargetSlotIndex", field("slot", "i")),
  ]),
  "KnowledgeIsPower.ServerBeginSortingAnsweringPhase": message([
    field("QuestionID", "s"),
    field("QuestionText", "s"),
    field("LeftBucketLabel", "s"),
    field("LeftBucketID", "s"),
    field("RightBucketLabel", "s"),
    field("RightBucketID", "s"),
    field("QuestionDuration", "d"),
    arr("SortingAnswers", sortingAnswer),
  ]),
  "KnowledgeIsPower.ServerBeginEliminatingAnsweringPhase": message([
    field("ChallengeId", "s"),
    field("QuestionText", "s"),
    field("QuestionDuration", "d"),
    arr("EliminatingAnswerData", eliminating),
    field("?serverTick", "i"),
  ]),
  "KnowledgeIsPower.ClientToServerEliminatingAnswer": message([field("AnswerCount", "i")]),
  "KnowledgeIsPower.ServerBeginMissingLetterAnsweringPhase": message([
    field("ChallengeId", "s"),
    field("Question", "s"),
    field("QuestionDuration", "d"),
    arr("MissingLetterAnswerData", missingLetter),
    field("?serverTick", "i"),
  ]),
  "KnowledgeIsPower.PrototypeClientToServerMissingLetterAnswer": message([
    field("ClientMissingLetterCorrectAnswerCount", "i"),
  ]),
  "KnowledgeIsPower.ServerBeginMatchingAnsweringPhase": message([
    field("ChallengeId", "s"),
    field("QuestionDuration", "d"),
    arr("MatchingData", matching),
    arr("DummyAnswerData", field("text", "s")),
    field("?serverTick", "i"),
  ]),
  "KnowledgeIsPower.ClientToServerMatchingAnswer": message([field("ClientMatchingCorrectAnswerCount", "i")]),
  "KnowledgeIsPower.ServerBeginOrderingAnsweringPhase": message([
    field("ChallengeId", "s"),
    field("QuestionText", "s"),
    field("QuestionDuration", "d"),
    arr("OrderingAnswerData", ordering),
    field("?serverTick", "i"),
  ]),
  "KnowledgeIsPower.ClientSortingAnswer": message([
    field("ClientSortingCorrectAnswerCount", "i"),
    arr("SortingAnswers", sortingEntry),
  ]),
  "KnowledgeIsPower.ClientTriviaAnswer": message([
    field("ChosenAnswerDisplayIndex", "i"),
    field("AnswerTime", "d"),
    field("NumBombsExploded", "i"),
    field("PaintCleared", "b"),
    field("IceCleared", "b"),
    field("NumWrongAnswers", "i"),
    field("TotalPaintLayersPerAnswer", "i"),
    field("PaintLayersClearedAnswer0", "i"),
    field("PaintLayersClearedAnswer1", "i"),
    field("PaintLayersClearedAnswer2", "i"),
    field("PaintLayersClearedAnswer3", "i"),
    field("TotalIceLayersPerAnswer", "i"),
    field("IceLayersClearedAnswer0", "i"),
    field("IceLayersClearedAnswer1", "i"),
    field("IceLayersClearedAnswer2", "i"),
    field("IceLayersClearedAnswer3", "i"),
  ]),
  "KnowledgeIsPower.ServerRequestEndOfGameFactCount": message([]),
  "KnowledgeIsPower.ClientEndOfGameFactCount": message([field("FactCount", "i")]),
  ClientEndOfGameFactCommandMessage: message([field("action", "i"), field("time", "d"), field("FactNumber", "i")]),
  "KnowledgeIsPower.ServerRoomMessage": message([field("Room", "i"), field("RoundType", "i")]),
  "KnowledgeIsPower.ClientToServerOngoingChallengeMessage": message([field("CorrectAnswerCount", "i")]),
  "KnowledgeIsPower.ClientToServerTimeSyncMessage": message([field("sentTick", "i")]),
  "KnowledgeIsPower.ServerToClientTimeSyncMessage": message([
    field("clientSentTick", "i"),
    field("serverSentTick", "i"),
  ]),
};

export class SchemaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SchemaError";
  }
}

function formatDouble(value: number): string {
  if (!Number.isFinite(value)) throw new SchemaError("non-finite number");
  const text = Object.is(value, -0) ? "-0.0" : String(value);
  if (text.includes("e") || text.includes("E")) return text;
  return text.includes(".") ? text : `${text}.0`;
}

function encodeField(spec: Field, value: unknown): string {
  if (value === undefined) {
    if (spec.optional) return "";
    throw new SchemaError(`missing ${spec.name}`);
  }
  switch (spec.kind) {
    case "s":
      if (typeof value !== "string") throw new SchemaError(`${spec.name} must be a string`);
      return JSON.stringify(value);
    case "b":
      if (typeof value !== "boolean") throw new SchemaError(`${spec.name} must be a boolean`);
      return value ? "true" : "false";
    case "i":
      if (typeof value !== "number" || !Number.isSafeInteger(value)) {
        throw new SchemaError(`${spec.name} must be a safe integer`);
      }
      return String(value);
    case "d":
      if (typeof value !== "number") throw new SchemaError(`${spec.name} must be a number`);
      return formatDouble(value);
    case "color":
    case "obj":
      return encodeObject(spec.fields ?? [], value);
    case "arr":
      if (!Array.isArray(value) || !spec.element) throw new SchemaError(`${spec.name} must be an array`);
      return `[${value.map((item) => encodeField(spec.element!, item)).join(",")}]`;
    default:
      throw new SchemaError(`bad field ${spec.name}`);
  }
}

function encodeObject(fields: Field[], value: unknown): string {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new SchemaError("expected an object");
  }
  const record = value as Record<string, unknown>;
  const known = new Set(fields.map((item) => item.name));
  for (const key of Object.keys(record)) {
    if (!known.has(key)) throw new SchemaError(`unknown field ${key}`);
  }
  const parts: string[] = [];
  for (const spec of fields) {
    if (record[spec.name] === undefined && spec.optional) continue;
    parts.push(`${JSON.stringify(spec.name)}:${encodeField(spec, record[spec.name])}`);
  }
  return `{${parts.join(",")}}`;
}

export function encodeMessageJson(message: Record<string, unknown>): string {
  const typeString = message.TypeString;
  if (typeof typeString !== "string") throw new SchemaError("missing TypeString");
  const fields = MESSAGE_FIELDS[typeString];
  if (!fields) throw new SchemaError(`unknown TypeString ${typeString}`);
  return encodeObject(fields, message);
}

/** Defaults the Kotlin client writes with encodeDefaults for messages this bridge originates. */
export function withClientDefaults(message: Record<string, unknown>): Record<string, unknown> {
  const typeString = message.TypeString;
  const next = { ...message };
  if (typeString === "ClientQuizCommandMessage" && next.time === undefined) next.time = 0;
  if (typeString === "ClientEndOfGameFactCommandMessage" && next.time === undefined) next.time = 0;
  if (typeString === "StartGameButtonPressedResponseMessage" && next.Response === undefined) next.Response = 9;
  if (typeString === "ContinuePressedResponseMessage" && next.Response === undefined) next.Response = 3;
  if (typeString === "KnowledgeIsPower.ClientTriviaAnswer") {
    const defaults: Record<string, number | boolean> = {
      NumBombsExploded: 0,
      PaintCleared: false,
      IceCleared: false,
      NumWrongAnswers: 0,
      TotalPaintLayersPerAnswer: 0,
      PaintLayersClearedAnswer0: 0,
      PaintLayersClearedAnswer1: 0,
      PaintLayersClearedAnswer2: 0,
      PaintLayersClearedAnswer3: 0,
      TotalIceLayersPerAnswer: 0,
      IceLayersClearedAnswer0: 0,
      IceLayersClearedAnswer1: 0,
      IceLayersClearedAnswer2: 0,
      IceLayersClearedAnswer3: 0,
    };
    for (const [key, value] of Object.entries(defaults)) {
      if (next[key] === undefined) next[key] = value;
    }
  }
  return next;
}
