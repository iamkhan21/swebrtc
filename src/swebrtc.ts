import { Signal, SignalTypes, WebRTCEvents } from "./types";
import * as getBrowserRTC from "get-browser-rtc";

const defaultConfig: RTCConfiguration = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
    {
      urls: "stun:global.stun.twilio.com:3478?transport=udp",
    },
    { urls: "stun:stun.stunprotocol.org" },
  ],
};

export class Swebrtc {
  private readonly _isInitiator: boolean;
  private readonly _wrtc;
  private readonly _pc: RTCPeerConnection;
  private _signalHandler: (event: Signal) => void;

  constructor({ config = defaultConfig, isInitiator = false } = {}) {
    if (typeof window === "undefined") {
      throw new Error("No WebRTC support: library should be used in browser");
    }

    this._wrtc = getBrowserRTC();

    if (!this._wrtc) {
      throw new Error("No WebRTC support: Not a supported browser");
    }
    this._isInitiator = isInitiator;

    this._pc = new this._wrtc.RTCPeerConnection(config);
    this._pc.onicecandidate = this.handleIceCandidate;
  }

  addStream(stream: MediaStream): void {
    stream.getTracks().forEach((track) => {
      this._pc.addTrack(track, stream);
    });
  }

  addSignal(signal: Signal): void {
    switch (signal.type) {
      case SignalTypes.offer: {
        this.handleSession(signal);
        this.createAnswer();
        break;
      }
      case SignalTypes.answer: {
        this.handleSession(signal);
        break;
      }
      case SignalTypes.iceCandidate: {
        this.addIceCandidate(signal);
        break;
      }
    }
  }

  on(eventType: WebRTCEvents, cb: (event?: unknown) => void): void {
    switch (eventType) {
      case WebRTCEvents.stream: {
        this._pc.ontrack = this.handleExternalStream(cb);
        break;
      }
      case WebRTCEvents.signal: {
        this._signalHandler = cb;
        if (this._isInitiator) this.createOffer();
        break;
      }
      case WebRTCEvents.connect: {
        if (this._pc.connectionState === "connected") {
          cb();
        }
        this._pc.onconnectionstatechange = () => {
          if (this._pc.connectionState === "connected") {
            cb();
          }
        };
        break;
      }
    }
  }

  private async addIceCandidate(signal: Signal) {
    try {
      await this._pc.addIceCandidate(signal.iceCandidate);
    } catch (e) {
      console.error("Error adding received ice candidate", e);
    }
  }

  private handleSession(signal: Signal) {
    const data = signal.offer || signal.answer;
    const remoteDesc = new this._wrtc.RTCSessionDescription(data);

    this._pc.setRemoteDescription(remoteDesc);
  }

  private async createAnswer() {
    const answer = await this._pc.createAnswer();
    await this._pc.setLocalDescription(answer);

    this._signalHandler({ type: SignalTypes.answer, answer });
  }

  private async createOffer() {
    const offer = await this._pc.createOffer();
    await this._pc.setLocalDescription(offer);

    this._signalHandler({ type: SignalTypes.offer, offer });
  }

  private handleIceCandidate(event) {
    if (event.candidate && this._signalHandler) {
      this._signalHandler({
        type: SignalTypes.iceCandidate,
        iceCandidate: event.candidate,
      });
    }
  }

  private handleExternalStream(cb: (stream: MediaStream | null) => void) {
    return (event) => {
      const stream = new MediaStream();
      event.streams[0].getTracks().forEach((track) => {
        stream.addTrack(track);
      });
      cb(stream);
    };
  }
}
