import { Swebrtc } from "./swebrtc";
import { Signal, WebRTCEvents } from "./types";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
globalThis.RTCPeerConnection = jest.fn(() => ({
  setLocalDescription: jest.fn(),
  setRemoteDescription: jest.fn(),
  createAnswer: jest.fn(() => ({ answer: "answer" })),
  createOffer: jest.fn(() => ({ offer: "offer" })),
  addTrack: jest.fn(),
  addIceCandidate: jest.fn(),
}));

globalThis.RTCSessionDescription = jest.fn();
globalThis.RTCIceCandidate = jest.fn();

describe("Swebrtc", () => {
  it("should trigger callbacks", async () => {
    const peer1 = new Swebrtc({ isInitiator: true });
    const peer2 = new Swebrtc();

    const onSignal1 = jest.fn().mockImplementation((cb) => (signal: Signal) => {
      peer2.addSignal(signal);
      cb();
    });
    const onSignal2 = jest.fn().mockImplementation((cb) => (signal: Signal) => {
      peer1.addSignal(signal);
      cb();
    });

    expect(peer1 instanceof Swebrtc).toBeTruthy();
    expect(peer2 instanceof Swebrtc).toBeTruthy();

    const creatingOffer = new Promise((resolve) => {
      peer1.on(WebRTCEvents.signal, onSignal1(resolve));
    });

    const creatingAnswer = new Promise((resolve) => {
      peer2.on(WebRTCEvents.signal, onSignal2(resolve));
    });

    await creatingOffer;
    await creatingAnswer;

    expect(onSignal1).toBeCalledTimes(1);
    expect(onSignal2).toBeCalledTimes(1);
  });
});
