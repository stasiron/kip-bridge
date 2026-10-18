/** Ports and magics copied from the pinned Reverse of Power sources. */

export const HTTP_HOST = "0.0.0.0";
export const HTTP_PORT = 8787;
export const SESSION_PATH = "/session";

/** Console game UDP port. `GameProtocolClient` default `serverPort`. */
export const PLAYLINK_SERVER_PORT = 9066;

/**
 * Port the console sends to. `GameProtocolClient` default `listenPort`.
 * A session binds this port on its own IPv4 address. The idle process does not.
 */
export const PLAYLINK_CLIENT_PORT = 9060;

/** PlayStation Device Discovery Protocol ports from `DdpDiscovery.kt`. */
export const DDP_PS4_PORT = 987;
export const DDP_PS5_PORT = 9302;
export const DDP_PS4_VERSION = "00020020";
export const DDP_PS5_VERSION = "00030010";

export const HEADER_BYTES = 22;
export const MAX_PAYLOAD_BYTES = 1002;
export const ACK_PACKET_BYTES = 38;

export const MAGIC_DATA_KIP = [0xae, 0x7f] as const;
export const MAGIC_DATA_DECADES = [0xc1, 0x48] as const;
export const MAGIC_ACK = [0x8a, 0x33] as const;
export const MAGIC_BODY_KIP = [0x33, 0x29] as const;
export const MAGIC_BODY_DECADES = [0xa3, 0xd3] as const;
export const MAGIC_UID_KIP = [0x0c, 0x89, 0xe8, 0x84, 0x61, 0x03, 0xf4] as const;
export const MAGIC_UID_DECADES = [0xaf, 0xe4, 0x87, 0x3d, 0x82, 0xed, 0x6c] as const;
export const TYPE_JSON = [0xb1, 0xe2, 0xff, 0xff] as const;
export const TYPE_MULTIJSON = [0x84, 0x12, 0x40, 0xee] as const;
export const FOOTER_MULTIJSON = [0x32, 0x90] as const;

/** Little-endian int32 markers from `ProtocolDecoder.decodePayload`. */
export const JSON_TYPE_MARKER = -7503;
export const MULTIJSON_TYPE_MARKER = -297790844;
export const JPEG_TYPE_MARKER = -520103681;

export const REFERENCE_COMMIT = "e9543047cd73cd93e1cbc59313a91f0f2c0f68cc";
export const REFERENCE_REPOSITORY = "https://github.com/synchrone/reverse-of-power";
