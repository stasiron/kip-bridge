import {
  HTTP_PORT,
  PLAYLINK_CLIENT_PORT,
  PLAYLINK_SERVER_PORT,
  REFERENCE_COMMIT,
  REFERENCE_REPOSITORY,
  SESSION_PATH,
} from "./config.ts";

export interface StatusInput {
  activeSessions?: number;
  endpointCount?: number;
  freeEndpoints?: number;
}

/**
 * `gameplay` and `controllerUi` are true when the static export draws the controller.
 * `playlink.bound` is true only while at least one session holds UDP 9060.
 */
export function bridgeStatus(input: StatusInput = {}) {
  const activeSessions = input.activeSessions ?? 0;
  return {
    service: "kip-browser-bridge" as const,
    gameplay: true as const,
    controllerUi: true as const,
    protocol: true as const,
    reason:
      activeSessions > 0
        ? "A PlayLink session is open. The page draws the controller from console events."
        : "No PlayLink session is open. UDP 9060 binds when a browser joins with the code printed by the bridge.",
    httpPort: HTTP_PORT,
    sessionPath: SESSION_PATH,
    playlink: {
      bound: activeSessions > 0,
      serverPort: PLAYLINK_SERVER_PORT,
      clientListenPort: PLAYLINK_CLIENT_PORT,
    },
    sessions: {
      active: activeSessions,
      endpoints: input.endpointCount ?? 0,
      free: input.freeEndpoints ?? 0,
    },
    reference: {
      repository: REFERENCE_REPOSITORY,
      commit: REFERENCE_COMMIT,
    },
  };
}

export type BridgeStatus = ReturnType<typeof bridgeStatus>;
