export enum WebRTCEvents {
  signal = "signal",
  stream = "stream",
  connect = "connect",
  close = "close",
}

export enum SignalTypes {
  offer = "offer",
  answer = "answer",
  iceCandidate = "iceCandidate",
}

export type Signal = Required<{ type: SignalTypes }> &
  Partial<{ answer: unknown; offer: unknown; iceCandidate: unknown }>;
