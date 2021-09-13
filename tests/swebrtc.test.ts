import { createPeer, getMediaStream } from "./_helpers";
import { ErrorTypes, Swebrtc } from "../src";

import test from "ava";

test("should throw error if webrtc not supported", (t) => {
  const error = t.throws(
    () => {
      new Swebrtc();
    },
    { instanceOf: Error }
  );

  t.is(error.message, ErrorTypes.WEBRTC_WRONG_ENV);
});

test("can detect error when RTCPeerConstructor throws", async (t) => {
  const p1 = new Swebrtc({
    wrtc: {
      RTCPeerConnection: null,
      RTCSessionDescription: null,
      RTCIceCandidate: null,
    },
  });

  await new Promise((resolve) => {
    p1.once("error", () => {
      p1.destroy();
      t.pass("Error was caught");
      resolve("Complete");
    });
  });
});

test("should create instance of swebrtc", async (t) => {
  const p1 = createPeer();

  t.truthy(p1 instanceof Swebrtc);

  p1.destroy();

  await new Promise((resolve) => {
    p1.once("close", () => {
      t.pass();
      resolve("Complete");
    });
  });
});

test("detect WebRTC support", (t) => {
  t.is(Swebrtc.WEBRTC_SUPPORT, typeof window !== "undefined");
});

test("should close connection on destroy", async (t) => {
  const p1 = createPeer();

  t.is(p1.status, "new");

  p1.destroy();

  await new Promise((resolve) => {
    p1.once("close", () => {
      t.is(p1.status, "closed");
      t.pass();
      resolve("Complete");
    });
  });
});

test("should create offer if it is initiator", async (t) => {
  const p2 = createPeer(true);

  p2.once("signal", (signal) => {
    t.is(signal.type, "offer");
    p2.destroy();
  });

  await new Promise((resolve) => {
    p2.once("close", () => {
      t.pass();
      resolve("Complete");
    });
  });
});

test("shouldn't create offer if it isn't initiator", async (t) => {
  const p1 = createPeer();

  p1.once("signal", () => {
    p1.destroy();
    t.fail("Offer was created");
  });

  await t.timeout(5e3);

  p1.destroy();
  t.pass();
});

test("should add signal and create answer on offer", async (t) => {
  const p1 = createPeer();
  const p2 = createPeer(true);

  p2.once("signal", (signal) => {
    p1.addSignal(signal);
  });

  p1.once("signal", (signal) => {
    t.is(signal.type, "answer");
    p1.destroy();
    p2.destroy();
  });

  await new Promise((resolve) => {
    p2.once("close", () => {
      t.pass();
      resolve("Complete");
    });
  });
});

test("should create connection between peers", async (t) => {
  const p1 = createPeer();
  const p2 = createPeer(true);

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

  await new Promise((resolve) => {
    p2.once("close", () => {
      t.pass();
      resolve("Complete");
    });
  });
});

test("should send messages between peers", async (t) => {
  const p1 = createPeer();
  const p2 = createPeer(true);

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

  await new Promise((resolve) => {
    p2.once("close", () => {
      t.pass();
      resolve("Complete");
    });
  });
});

test.skip("should add and send stream to other peer", async (t) => {
  // @ts-ignore
  globalThis.MediaStream = function () {
    return {
      addTrack: (track: MediaStreamTrack) => {
        return;
      },
    };
  };

  const p1 = createPeer();
  const p2 = createPeer(true);

  const stream = getMediaStream();

  p1.addStream(stream);
  p2.addStream(stream);

  p2.once("stream", () => {
    p1.destroy();
    p2.destroy();
  });

  p1.on("signal", (signal) => {
    p2.addSignal(signal);
  });

  p2.on("signal", (signal) => {
    p1.addSignal(signal);
  });

  const a1 = new Promise((resolve) => {
    p1.once("close", () => {
      resolve("Complete");
    });
  });

  const a2 = new Promise((resolve) => {
    p2.once("close", () => {
      resolve("Complete");
    });
  });

  await a1;
  await a2;

  t.pass();
});
