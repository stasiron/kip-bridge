/**
 * Wire constants from ProtocolEncoder.kt / ProtocolDecoder.kt.
 * This module does not encode or decode packets.
 */
export const HEADER_BYTES = 22;
export const MAX_PAYLOAD_BYTES = 1002;
export const ACK_PACKET_BYTES = 38;

export const MAGIC_PACKET_KIP = [0xae, 0x7f] as const;
export const MAGIC_PACKET_DECADES = [0xc1, 0x48] as const;
export const MAGIC_ACK = [0x8a, 0x33] as const;
export const MAGIC_BODY_KIP = [0x33, 0x29] as const;
export const MAGIC_BODY_DECADES = [0xa3, 0xd3] as const;

/** 7 bytes; the 8th flag byte defaults to 0x63 in encodeDeviceUID. */
export const MAGIC_UID_KIP = [0x0c, 0x89, 0xe8, 0x84, 0x61, 0x03, 0xf4] as const;
/** 7 bytes; Decades comment in GameProtocol2Client.kt records a following 0x47. */
export const MAGIC_UID_DECADES = [0xaf, 0xe4, 0x87, 0x3d, 0x82, 0xed, 0x6c] as const;

/** Little-endian int32 markers. */
export const TYPE_JSON = -7503;
export const TYPE_MULTI_JSON = -297790844;
export const TYPE_JPEG = -520103681;

export const MULTI_JSON_FOOTER = [0x32, 0x90] as const;

/** InterfaceVersionMessage.InterfaceVersion prefixes. */
export const VERSION_KIP_PREFIX = "KIP_";
export const VERSION_DECADES_PREFIX = "KIP2_";
export const VERSION_KIP_OBSERVED = "KIP_2016-11-14-1222";
export const VERSION_DECADES_OBSERVED = "KIP2_2018-06-08-1531";
