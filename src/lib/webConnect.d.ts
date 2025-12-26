export type WebConnectPeer = {
  peerId: string;
  displayName: string;
};

export type WebConnectChat = {
  peerId: string;
  displayName: string;
  text: string;
  timestamp: number;
  roll?: {
    expression: string;
    total: number;
    breakdown: string;
  };
};

export type WebConnectCaption = {
  peerId: string;
  displayName: string;
  text: string;
  timestamp: number;
};

export type WebConnectRoom = {
  on: (
    event:
      | "ready"
      | "roster"
      | "peer-joined"
      | "peer-left"
      | "stream"
      | "chat"
      | "caption"
      | "navigate"
      | "error",
    handler: (payload: any) => void
  ) => () => void;
  sendChat: (
    message:
      | string
      | {
          text: string;
          roll?: {
            expression: string;
            total: number;
            breakdown: string;
          };
        }
  ) => void;
  sendCaption: (text: string) => void;
  sendNavigate: (payload: { path: string; label?: string }) => void;
  disconnect: () => void;
};

export function createWebConnectRoom(options: {
  roomId: string;
  displayName: string;
  roomName?: string | null;
  stream: MediaStream | null;
  debug?: boolean;
}): WebConnectRoom;
