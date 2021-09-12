import { createPeer, getMediaStream } from "./helpers";
import { ErrorTypes, Swebrtc } from "../src";

Object.defineProperty(globalThis, "MediaStream", {
  writable: true,
  value: jest.fn().mockImplementation(() => ({
    addTrack: jest.fn(),
  })),
});

describe("Swebrtc", function () {
  describe("creating and initializing", function () {
    it("should throw error if webrtc not supported", () => {
      expect(() => new Swebrtc()).toThrowError(ErrorTypes.WEBRTC_WRONG_ENV);
    });

    it("can detect error when RTCPeerConstructor throws", (done) => {
      const p1 = new Swebrtc({
        wrtc: {
          RTCPeerConnection: null,
          RTCSessionDescription: null,
          RTCIceCandidate: null,
        },
      });

      p1.once("error", () => {
        p1.destroy();
        done();
      });
    });

    it("should create instance of swebrtc", (done) => {
      const p1 = createPeer();

      expect(p1).toBeInstanceOf(Swebrtc);

      p1.once("close", () => {
        done();
      });

      p1.destroy();
    });
  });

  describe("methods", () => {
    let p1: Swebrtc;
    let p2: Swebrtc;

    afterEach(() => {
      p1?.destroy();
      p2?.destroy();
    });

    it("detect WebRTC support", () => {
      expect(Swebrtc.WEBRTC_SUPPORT).toBe(typeof window !== "undefined");
    });

    it("should close connection on destroy", (done) => {
      p1 = createPeer();

      expect(p1.status).toBe("new");

      p1.once("close", () => {
        expect(p1.status).toBe("closed");
        done();
      });

      p1.destroy();
    });

    it("should create offer if it is initiator", (done) => {
      p2 = createPeer(true);

      p2.once("signal", (signal) => {
        expect(signal).toHaveProperty("type", "offer");
        p2.destroy();
      });

      p2.once("close", () => {
        done();
      });
    });

    it("shouldn't create offer if it isn't initiator", (done) => {
      p1 = createPeer();

      const timeout = setTimeout(() => {
        p1.destroy();
        queueMicrotask(() => done());
      }, 1000);

      p1.once("signal", () => {
        p1.destroy();
        clearTimeout(timeout);

        queueMicrotask(() => done("Offer was created"));
      });
    });

    it("should add signal and create answer on offer", (done) => {
      p1 = createPeer();
      p2 = createPeer(true);

      p2.once("signal", (signal) => {
        p1.addSignal(signal);
      });

      p1.once("signal", (signal) => {
        expect(signal).toHaveProperty("type", "answer");
        p1.destroy();
        p2.destroy();
      });

      p2.once("close", () => {
        done();
      });
    });

    it("should create connection between peers", (done) => {
      p1 = createPeer();
      p2 = createPeer(true);

      p1.on("signal", (signal) => {
        p2.addSignal(signal);
      });

      p2.on("signal", (signal) => {
        p1.addSignal(signal);
      });

      p1.once("connect", () => {
        p1.destroy();
        p2.destroy();
      });

      p2.once("close", () => {
        done();
      });
    });

    it("should send messages between peers", (done) => {
      p1 = createPeer();
      p2 = createPeer(true);

      p1.on("signal", (signal) => {
        p2.addSignal(signal);
      });

      p2.on("signal", (signal) => {
        p1.addSignal(signal);
      });

      p1.on("connect", () => {
        p1.send(JSON.stringify({ msg: "ping" }));
      });

      p2.on("data", (data) => {
        const { msg } = JSON.parse(data);

        if (msg === "ping") p2.send(JSON.stringify({ msg: "pong" }));
      });

      p1.on("data", (data) => {
        const { msg } = JSON.parse(data);

        if (msg === "pong") {
          p1.destroy();
          p2.destroy();
        }
      });

      p2.once("close", () => {
        done();
      });
    });

    it("should add and send stream to other peer", (done) => {
      p1 = createPeer();
      p2 = createPeer(true);

      const stream = getMediaStream();

      p1.addStream(stream);
      p2.addStream(stream);

      p2.on("stream", () => {
        p1.destroy();
        p2.destroy();
      });

      p1.on("signal", (signal) => {
        p2.addSignal(signal);
      });

      p2.on("signal", (signal) => {
        p1.addSignal(signal);
      });

      p2.once("close", () => {
        done();
      });
    });
  });
});
