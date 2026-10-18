# PlayLink protocol

All behavior below is taken from Reverse of Power commit `e9543047cd73cd93e1cbc59313a91f0f2c0f68cc`. Field names and `TypeString` values live in `bridge/src/protocol/messages.ts` and match `app/src/main/java/com/game/protocol/GameMessages.kt`. Nothing in that list was added.

Packet captures cited here are the text replays in the upstream `docs/` directory. The `.pcapng` files are gitignored upstream and are not copied into this project.

## Discovery

Source: `app/src/main/java/com/game/remoteclient/network/DdpDiscovery.kt`, `models/PlayStationConsole.kt`, `models/GameServer.kt`.

The client broadcasts, from an ephemeral UDP socket:

```
SRCH * HTTP/1.1
device-discovery-protocol-version:<version>
```

| Target | Port | Version string |
| --- | --- | --- |
| PS4 | 987 | `00020020` |
| PS5 | 9302 | `00030010` |

It tries the Wi-Fi broadcast address first, then `255.255.255.255`, and waits 3 seconds. A reply is HTTP-shaped. The parser requires `host-id`. It also reads `host-type`, `host-name`, `system-version`, and `host-request-port`. Status code 200 is “awake”.

`NetworkManager.scanForServers` keeps awake consoles and builds a `GameServer` with port **9066**. `host-request-port` is stored and not used as the game port. The discovery UI also has a manual address (`ServerDiscoveryFragment`).

The bridge will send this broadcast. The iPhone will not.

## Sockets

Source: `GameProtocolClient.kt` (`serverPort` default 9066, `listenPort` default 9060, `startListening`), `PcapReplay.kt` (destination port 9060 means server to client, 9066 means client to server).

| Direction | Destination |
| --- | --- |
| Client to console | console IPv4, UDP **9066**, from a socket bound to port 0 |
| Console to client | client IPv4, UDP **9060** |

The receive socket is IPv4 (`Inet4Address`, `java.net.preferIPv4Stack`). Sends of connection, UID, ACK, and image bytes take `sendLock`. `sendMessage` does not.

## Handshake

Sources: `GameProtocolClient.connect`, `handleProtocolMessage`, `ProtocolEncoder.encodeConnectionRequest`, `encodeDeviceUID`, `encodeAck`. Traces: `docs/fullgame.txt`, `docs/reconnect-join-after-next-question-up-to-powerplay.txt`.

Until the first server data message, the client repeats about once a second:

1. Connection request: `8A 33` + int32 `-1` + 32 zero bytes (38 bytes).
2. Device UID for classic, then the same UID with the Decades magic.

`NetworkManager.init` stores the UID as a UUID with the dashes removed (32 hex characters).

The code sends the connection request before the UID packets. `docs/fullgame.txt` shows the opposite order on the first two client datagrams, and the console still answered. Order is not proven to be significant. The port should follow the current Kotlin loop.

The console then sends an 8-byte datagram the decoder classifies as `Unknown`. In `fullgame.txt` the bytes are `4e dd 96 66 3b 27 4f 63`. In the reconnect trace the last byte differs (`35`). `GameProtocolClient` ignores it. The connection is complete only when a 38-byte `8A 33` packet with message id `-1` arrives (`DecodedPacket.ConnectionInit`).

Observed server sequence after that:

| Step | Message | Client reaction in code |
| --- | --- | --- |
| 1 | `InterfaceVersionMessage` | Remember Decades when the version starts with `KIP2_`. Classic capture value: `KIP_2016-11-14-1222`. |
| 2 | `SessionStateMessage` | Send `ClientRequestPlayerIDMessage` with the UID. |
| 3 | `AssignPlayerIDAndSlotMessage` | Store `PlayerID` and `SlotID`. Send `DeviceInfoMessage` then `ClientRequestAvatarStatusMessage`. |
| 4 | `ResourceRequirementsMessage`, often bundled with `ClientQuizCommandMessage` action 31 and avatar rows | Request each missing GUID, or send `AllResourcesReceivedMessage` if none are missing. |

`DeviceInfoMessage` values the working client sends: `Response=10`, `DeviceSize=2`, `DeviceOS=1`, `DeviceType="Handheld"`, plus model and OS strings. Whether the console checks the numeric fields is not stated in source. A port should keep those numbers until a capture shows a browser string succeeding with different numbers.

`UDPPortOffset` is 0 in the classic full game, the Decades trace, and the reconnect trace. The client does not read it.

Reconnect with the same UID (`docs/reconnect-join-after-next-question-up-to-powerplay.txt`) still uses offset 0. The console restores `DisplayName` and later sends `RejoiningClientOwnProfileMessage` (name, portrait GUID, colour, avatar id). `ServerDiscoveryFragment` treats that, or an early holding screen, as “skip name entry”.

`SessionID` differs across captures (627950993 and 500469084). Each capture has one client, so it is not known whether the id is per game or per player.

## Framing

Sources: `ProtocolEncoder.kt`, `ProtocolDecoder.kt`.

Data packets, little-endian int32:

| Offset | Field |
| --- | --- |
| 0 | Magic `AE 7F` (classic) or `C1 48` (Decades) |
| 2 | Message id |
| 6 | Packet count |
| 10 | Zero-based packet index |
| 14 | Payload length in this datagram |
| 18 | Cumulative byte offset |
| 22 | Payload, at most 1002 bytes |

The client message counter starts at 0 and pre-increments, so the first client data message is id 1. Server ids are a separate sequence. In `fullgame.txt` the server starts at `0x0c`. On reconnect the server continues a high sequence (`0x347`).

Body after reassembly:

| Offset | Field |
| --- | --- |
| 0 | Body magic `33 29` (classic) or `A3 D3` (Decades) |
| 2 | Type marker, or a positive transfer id |
| 6 | Body length, or the type marker when a transfer id was present |

Type markers:

| Bytes | Int32 | Kind |
| --- | --- | --- |
| `B1 E2 FF FF` | -7503 | One JSON object |
| `84 12 40 EE` | -297790844 | Multi-JSON |
| `FF D8 FF E0` | -520103681 | JPEG |

Multi-JSON entries are int32 document length, int32 type marker, then bytes. The block ends with `32 90`. `encodeMessageMulti` exists. The live client sends one JSON object per `sendMessage`. Captures also show several objects in one packet (message `0x03` in `fullgame.txt` contains both the avatar-status request and `DeviceInfoMessage`). The decoder accepts both shapes.

JSON is UTF-8. `ProtocolEncoder` uses kotlinx serialization with `encodeDefaults = true`, so defaulted fields including `TypeString` are written. Property order follows the Kotlin declaration. Some `TypeString` values are prefixed `KnowledgeIsPower.` and some are not. The prefix is part of the value. See `messages.ts`.

Fragments share a message id. The decoder stores them by index and concatenates when the count is complete. The map is per decoder instance, not per remote address.

## ACK and NACK

Sources: `ProtocolEncoder.encodeAck`, `ProtocolDecoder` magic `8A 33`, `GameProtocolClient.connect` and `sendAck`.

An ACK is 38 bytes: `8A 33`, the int32 message id, 32 zero bytes. A NACK is the same header with any non-zero byte in those 32. The client logs neither in the current source (the log lines are commented out) and does not keep a retransmission buffer.

After the first server data message, the 1-second loop sends an ACK of `lastRcvMessageId` only. The console ACKs client message ids the same way. The traces show this pair repeating. Reliability, as implemented, is a heartbeat of the latest id, not selective repeat.

## Images and avatars

Sources: `ProtocolEncoder.encodeImageTransfer`, `GameProtocolClient` pending maps, `CameraCaptureFragment` and `AvatarSelectionFragment` (`transferId = 2`), `NetworkManager.sendImageProfileImage`.

The phone sends, under one lock:

1. `ClientImageResourceContentTransferMessage` with `TransferID`, `ImageGUID`, `ImgType=2`.
2. JPEG bytes in a body whose first int32 is that transfer id (positive), so the JPEG’s own `FF D8 FF E0` is read as the type marker.
3. `ClientPlayerProfileMessage`.
4. The same JPEG again with `TransferID + 1` and the same GUID.

`fullgame.txt` shows transfer ids 2 and 3 and a 12344-byte JPEG split across 13 datagrams.

The console may send `ImageResourceContentTransferMessage` and the JPEG in either order. The client matches them by transfer id, stores bytes by GUID (`NetworkManager.receivedImages`), and emits `AllResourcesReceivedMessage` for that GUID with `Rqrmnt=0`.

Avatar ids are strings on `ServerAvatarStatusMessage`. The classic capture lists `COWGIRL`, `GOFF`, `HOTDOGMAN`, `LOVER`, `MOUNTAINEER`, `SCIENTIST`, `SPACEMAN`, `MAGICIAN`. The client requests one with `ClientRequestAvatarMessage` (`Request=true`, a new `RequestID`) and releases the previous id with `Request=false`. The console answers with `ServerAvatarRequestResponseMessage` and a status update. Decades avatar ids must be taken from the live `ServerAvatarStatusMessage` list. The comment in `GameProtocol2Client.kt` names only a few of them.

Photo overlay masks are not in the upstream app and must not be added here.

## Commands the client sends

Auto replies inside `GameProtocolClient.handleProtocolMessage`:

| Trigger | Reply |
| --- | --- |
| `SessionStateMessage` | `ClientRequestPlayerIDMessage` |
| `AssignPlayerIDAndSlotMessage` | `DeviceInfoMessage`, then `ClientRequestAvatarStatusMessage` |
| `ResourceRequirementsMessage` with nothing missing | `AllResourcesReceivedMessage` echoing the list |
| `ResourceRequirementsMessage` with missing GUIDs | `RequestResourceMessage` per GUID |
| `ServerRequestEndOfGameFactCount` | `ClientEndOfGameFactCount` with `FactCount=63` |

The fact-count line is marked TODO in source (“random number”). `CLAUDE.md` says 0. The code sends 63. Follow the code until a capture shows the console requiring another value.

UI replies from `NetworkManager`: profile, start (`StartGameButtonPressedResponseMessage`, `Response=9`), continue (`ContinuePressedResponseMessage`, `Response=3`), avatar request, category choice, category override, trivia, linking, ordering, sorting, elimination, missing letter, matching, ongoing challenge progress, and power-play choice.

`ClientToServerTimeSyncMessage` appears about twice a second in `docs/fullgame-decades.txt` and is answered by `ServerToClientTimeSyncMessage`. The current `GameProtocolClient` does not send it. It only logs the server message. `sentTick` values in that trace have the magnitude of .NET `DateTime` ticks. That epoch is an inference from the integers, not a comment in the Kotlin. Classic `docs/fullgame.txt` does not show this exchange.

## Commands the console sends

Names that start with `Client` are still console-to-phone when the trace direction is S→C or the only handler is on receive:

- `ClientQuizCommandMessage`
- `ClientHoldingScreenCommandMessage`
- `ClientGameIDMessage` (`fullgame.txt` message `0x14`)
- `ClientEndOfGameFactCommandMessage`

`ClientGameIDMessage` is decoded and not given a UI branch. The game proceeds without it. Store it when a session exists; do not invent a reply.

Quiz `action` constants (`GameMessages.kt`) and what the UI does with them:

| Value | Constant | UI |
| --- | --- | --- |
| 4 | `ACTION_CONTINUE` | `HoldingScreenFragment` opens the continue screen |
| 14 | `ACTION_READY` | `WaitingRoomFragment` shows the start control. Capture packet `0x13` is this, after the profile |
| 15 | `ACTION_EXIT` | No branch in the UI |
| 29 | `ACTION_PAUSED` | No branch in the UI |
| 30 | `ACTION_UNPAUSED` | No branch in the UI |
| 31 | `ACTION_RESET_TO_NAME` | `MainActivity` navigates to name entry. On a fresh connection the same value arrives with the avatar list (`fullgame.txt` message `0x0f`) |

Holding-screen `HoldingScreenType` from the field comment and the captures:

| Value | Evidence |
| --- | --- |
| 4 | Comment and UI fallback “look at the TV”. Common in both traces |
| 5 | Comment: players joining. `ContinueFragment` ignores type 5 so a join notice does not dismiss continue |
| 8 | Reconnect trace, before `RejoiningClientOwnProfileMessage`. No name in source |
| 9 | Comment and UI string “Get ready!” |

Holding-screen `action` is 5 in those captures. The holding-screen UI does not branch on it.

Navigation from `HoldingScreenFragment` and `nav_graph.xml`:

| Message | Screen |
| --- | --- |
| `ServerCategorySelectChoices` | Category doors |
| `ServerBeginTriviaAnsweringPhase` | Trivia |
| Quiz action 4 | Continue |
| `ServerBeginPowerPlayPhase` | Power play |
| `ServerBeginLinkingAnsweringPhase` | Linking pairs |
| `ServerBeginOrderingAnsweringPhase` | Ordering, rendered with the linking answers screen |
| `ServerBeginSortingAnsweringPhase` | Sorting |
| `ServerBeginEliminatingAnsweringPhase` | Elimination |
| `ServerBeginMissingLetterAnsweringPhase` | Missing letter |
| `ServerBeginMatchingAnsweringPhase` | Matching |
| `ClientEndOfGameFactCommandMessage` | End-of-game fact |

`CategorySelectionFragment` sets `selectionEnabled` false after the first door tap, so a later `ServerCategorySelectChoices` can refresh labels without opening a second choice.

Trivia timeout sends `ChosenAnswerDisplayIndex=-1` and `AnswerTime=QuestionDuration` (`TriviaAnsweringFragment`).

Power play (`PowerPlayFragment`): if `TargetCount > 1`, send `PowerPlaySlotIndex = DisplayIndex` and `TargetSlotIndex = PowerPlayTargets` with no picker. Otherwise the player picks one slot from `PowerPlayTargets`. `PowerPlaySlotIndex` is the display index, not the power-type integer. If `ServerRequestPowerPlayChoice` arrives with nothing selected, the client sends slot `-1` and an empty target list.

`CLAUDE.md` describes `PowerTarget` 1 (self), 2 (one opponent), 4 (everyone), and an unexplained 5. The fragment routes on `TargetCount`, not on `PowerTarget`. Keep both fields. Do not collapse them until a capture shows they always agree.

`PowerType` integers are the `POWER_TYPE_VALUES` map in `messages.ts`. Decades uses `PowerTypes` (a list) and `PowerType=-1` as an empty slot (`GameProtocol2Client.kt`, `PowerPlay.effectivePowerType`).

## Decades differences recorded upstream

Source: the comment block in `GameProtocol2Client.kt` and `docs/fullgame-decades.txt`. Treat the comment as notes, not as a second encoder.

- Version prefix `KIP2_`. Packet magic `C1 48`, body magic `A3 D3`, UID magic `AF E4 87 3D` and flags `82 ED 6C` plus the trailing flag byte.
- The client probes both UID magics until `InterfaceVersionMessage` selects the encoder.
- Extra messages: `ServerRoomMessage`, `ServerAwaitTriviaAnsweringPhaseMessage`, missing-letter begin/answer, `ClientToServerOngoingChallengeMessage`, time sync.
- The note says sorting, colour, player join/leave, and end-of-game facts are absent on Decades. Confirm per session rather than dropping those decoders.
- The same note says Decades resources use `Rqrmnt=1` and classic uses `Rqrmnt=2`. The classic reconnect trace contains `Rqrmnt=1`. The client ignores `Rqrmnt` and keys off the GUID. Do not branch on that comment alone.

## Messages that must not be invented

`DecodedPacket.GameInProgress` is declared and never constructed. There is no packet layout for it.

If a `TypeString` is not in `messages.ts`, log it and leave it unparsed. `ProtocolDecoder.parseJsonPayload` already does that (`Unknown TypeString`).

## One address, one port

A single bridge address and a single UDP 9060 socket can carry one player. The header cannot tell two players’ datagrams apart, and several prompts are untagged. Details and the multi-address alternative are in `architecture.md`.
