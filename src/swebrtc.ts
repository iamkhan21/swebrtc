import { Wrtc } from "./types";
import { getBrowserRTC, getRandomBytes } from "./utils";
import { ErrorTypes } from "./constants";

const defaultConfig: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.stunprotocol.org" }],
};

export type SwebrtcOptions = {
  isInitiator?: boolean;
  config?: RTCConfiguration;
  wrtc?: Wrtc;
};

export class Swebrtc {
  private readonly isInitiator: boolean;
  private readonly wrtc: Wrtc;

  private eventHandlers = new Map();

  private pc: RTCPeerConnection;
  private dataChannel: RTCDataChannel;

  private isPeerDestroyed = false;
  private isPeerNegotiating = false;
  private isFirstNegotiation = true;
  private needRenegotiate = false;
  private batchedNegotiation = false;

  constructor(opts: SwebrtcOptions = {}) {
    this.isInitiator = opts.isInitiator ?? false;

    this.wrtc =
      opts.wrtc && typeof opts.wrtc === "object" ? opts.wrtc : getBrowserRTC();

    if (!this.wrtc) {
      if (typeof window === "undefined") {
        throw new Error(ErrorTypes.WEBRTC_WRONG_ENV);
      } else {
        throw new Error(ErrorTypes.WEBRTC_NOT_SUPPORTED);
      }
    }

    try {
      this.pc = new this.wrtc.RTCPeerConnection(opts.config ?? defaultConfig);
    } catch (e) {
      this.destroy(e);
      return;
    }

    this.initializePeerListeners();

    if (this.isInitiator) {
      const channelName = getRandomBytes(20).toString();
      const dataChannel = this.pc.createDataChannel(channelName);
      this.initializeDataChannel(dataChannel);
    }

    this.prepareNegotiation();
  }

  static get WEBRTC_SUPPORT(): boolean {
    return Boolean(getBrowserRTC());
  }

  get status(): RTCPeerConnectionState {
    return this.pc.connectionState;
  }

  addStream(stream: MediaStream): void {
    stream.getTracks().forEach((track) => {
      this.pc.addTrack(track, stream);
    });

    this.prepareNegotiation();
  }

  async addSignal(signal: Record<string, unknown>): Promise<void> {
    switch (signal.type) {
      case "offer": {
        await this.handleSession(signal);
        await this.createAnswer();
        break;
      }
      case "answer": {
        await this.handleSession(signal);
        break;
      }
      case "candidate": {
        await this.addIceCandidate(signal.candidate);
        break;
      }
      case "renegotiate": {
        if (this.isInitiator) this.prepareNegotiation();
        break;
      }
    }
  }

  destroy(err?: Error): void {
    if (this.isPeerDestroyed) return;

    queueMicrotask(() => {
      this.isPeerDestroyed = true;

      if (this.dataChannel) {
        try {
          this.dataChannel.close();
        } catch (err) {
          this.emit("error", err);
        }

        this.dataChannel.onmessage = null;
        this.dataChannel.onopen = null;
        this.dataChannel.onclose = null;
        this.dataChannel.onerror = null;
      }

      if (this.pc) {
        try {
          this.pc.close();
        } catch (err) {
          this.emit("error", err);
        }

        this.pc.onconnectionstatechange = null;
        this.pc.onicecandidate = null;
        this.pc.ondatachannel = null;
        this.pc.ontrack = null;
      }

      if (err) this.emit("error", err);
      this.emit("close");
    });
  }

  on(event: string, handler: (...arg) => void): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event).add(handler);
  }

  off(event: string, handler: (...arg) => void): void {
    const handlers = this.eventHandlers.get(event);
    if (!handlers) return;

    handlers.delete(handler);
    if (handlers.size === 0) this.eventHandlers.delete(event);
  }

  once(event: string, handler: (...arg) => void): void {
    const listener_ = (...args) => {
      this.off(event, listener_);
      handler(...args);
    };
    this.on(event, listener_);
  }

  send(data: string | ArrayBufferView | ArrayBuffer | Blob): void {
    // @ts-ignore
    this.dataChannel?.send(data);
  }

  private emit(event: string, ...data: unknown[]): void {
    if (!this.eventHandlers.has(event)) return;

    const handlers = this.eventHandlers.get(event);
    for (const handler of handlers) {
      try {
        handler(...data);
      } catch (err) {
        console.error(err);
      }
    }
  }

  private prepareNegotiation() {
    if (this.batchedNegotiation) return;
    this.batchedNegotiation = true;

    queueMicrotask(() => {
      this.batchedNegotiation = false;

      if (this.isInitiator || !this.isFirstNegotiation) {
        this.startNegotiation();
      }

      this.isFirstNegotiation = false;
    });
  }

  private startNegotiation() {
    if (this.isPeerDestroyed) return;

    if (this.isPeerNegotiating) {
      this.needRenegotiate = true;
      return;
    }

    if (this.isInitiator) {
      this.createOffer();
    } else {
      this.emit("signal", {
        type: "renegotiate",
      });
    }

    this.isPeerNegotiating = true;
  }

  private initializeDataChannel(dataChannel: RTCDataChannel) {
    this.dataChannel = dataChannel;
    this.dataChannel.onmessage = ({ data }) => {
      this.emit("data", data);
    };

    this.dataChannel.onopen = () => {
      this.onConnectionStateChange();
    };

    this.dataChannel.onclose = () => {
      this.onConnectionStateChange();
    };

    this.dataChannel.onerror = (err) => {
      this.destroy(err["message"]);
    };
  }

  private async createOffer() {
    const offer = await this.pc.createOffer();

    const signal = this.pc.localDescription || offer;
    await this.pc.setLocalDescription(offer);

    this.emit("signal", {
      type: signal.type,
      sdp: signal.sdp,
    });
  }

  private async createAnswer() {
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);

    this.emit("signal", answer);
  }

  private async handleSession(signal: any) {
    const remoteDesc = new this.wrtc.RTCSessionDescription(
      signal as RTCSessionDescription
    );

    await this.pc.setRemoteDescription(remoteDesc);
  }

  private initializePeerListeners() {
    this.pc.onconnectionstatechange = () => {
      this.onConnectionStateChange();
    };

    this.pc.onsignalingstatechange = () => {
      this.onSignalingStateChange();
    };

    this.pc.onicecandidate = ({ candidate }) => {
      candidate && this.onIceCandidate(candidate);
    };

    if (!this.isInitiator) {
      this.pc.ondatachannel = ({ channel }) => {
        this.initializeDataChannel(channel);
      };
    }
    this.pc.ontrack = (event) => this.handleExternalStream(event);
  }

  private onConnectionStateChange() {
    if (
      this.dataChannel?.readyState === "open" &&
      this.pc.connectionState === "connected"
    ) {
      this.emit("connect");
    } else if (
      this.dataChannel?.readyState === "closed" ||
      this.pc.connectionState === "closed"
    ) {
      this.destroy();
    }
  }

  private onSignalingStateChange() {
    if (this.isPeerDestroyed) return;

    if (this.pc.signalingState === "stable") {
      this.isPeerNegotiating = false;

      if (this.needRenegotiate) {
        this.needRenegotiate = false;
        this.prepareNegotiation(); // negotiate again
      }
    }
  }

  private onIceCandidate(candidate: RTCIceCandidate) {
    this.emit("signal", { type: "candidate", candidate });
  }

  private async addIceCandidate(candidate: any) {
    try {
      await this.pc.addIceCandidate(candidate);
    } catch (e) {
      console.error("Error adding received ice candidate", e);
    }
  }

  private handleExternalStream({ streams }: RTCTrackEvent) {
    const stream = new MediaStream();

    streams[0].getTracks().forEach((track) => {
      stream.addTrack(track);
    });

    queueMicrotask(() => {
      this.emit("stream", stream);
    });
  }
}
