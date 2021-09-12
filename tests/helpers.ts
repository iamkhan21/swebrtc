import { Swebrtc } from "../src";
import * as wrtc from "wrtc";

// Used for testing purposes - inject wrtc library for emulating WebRTC in node environment
export const createPeer = (isInitiator = false): Swebrtc =>
  new Swebrtc({ isInitiator, wrtc });

export const getMediaStream = (): MediaStream => {
  const source = new wrtc.nonstandard.RTCVideoSource();
  const tracks = [source.createTrack(), source.createTrack()];
  return new wrtc.MediaStream(tracks);
};
