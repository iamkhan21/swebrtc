import { Wrtc } from "../types";

export const getBrowserRTC = (): Wrtc | null => {
  if (typeof globalThis === "undefined") return null;

  const wrtc: Wrtc = {
    RTCPeerConnection:
      globalThis.RTCPeerConnection ||
      globalThis.mozRTCPeerConnection ||
      globalThis.webkitRTCPeerConnection,
    RTCSessionDescription:
      globalThis.RTCSessionDescription ||
      globalThis.mozRTCSessionDescription ||
      globalThis.webkitRTCSessionDescription,
    RTCIceCandidate:
      globalThis.RTCIceCandidate ||
      globalThis.mozRTCIceCandidate ||
      globalThis.webkitRTCIceCandidate,
  };

  if (!wrtc.RTCPeerConnection) return null;

  return wrtc;
};
