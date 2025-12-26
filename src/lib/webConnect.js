// webConnect.js uses a PeerJS room host for discovery, then fans out to a mesh.
// The first peer to claim `roomId` becomes host and shares a roster over data channels.
const DEFAULT_PEER_OPTIONS = { debug: 0 };

const shouldInitiateConnection = (localId, remoteId) => {
  if (!localId || !remoteId) return false;
  return localId.localeCompare(remoteId) < 0;
};

const createEmitter = () => {
  const listeners = new Map();
  return {
    on(event, handler) {
      const list = listeners.get(event) ?? new Set();
      list.add(handler);
      listeners.set(event, list);
      return () => list.delete(handler);
    },
    emit(event, payload) {
      const list = listeners.get(event);
      if (!list) return;
      list.forEach((handler) => handler(payload));
    }
  };
};

export const createWebConnectRoom = ({
  roomId,
  displayName,
  roomName,
  stream,
  debug = false
}) => {
  const emitter = createEmitter();
  const connections = new Map();
  const calls = new Map();
  const roster = new Map();
  let peer = null;
  let peerId = null;
  let isHost = false;
  let destroyed = false;

  const log = (...args) => {
    if (debug) {
      console.log("[webConnect]", ...args);
    }
  };

  const safeSend = (conn, message) => {
    if (!conn || !conn.open) return;
    conn.send(message);
  };

  const broadcast = (message) => {
    connections.forEach((conn) => safeSend(conn, message));
  };

  const handlePeerLeft = (remoteId) => {
    connections.delete(remoteId);
    const call = calls.get(remoteId);
    if (call) {
      call.close();
      calls.delete(remoteId);
    }
    if (roster.has(remoteId)) {
      roster.delete(remoteId);
    }
    emitter.emit("peer-left", { peerId: remoteId });
    if (isHost) {
      broadcast({ type: "peer-left", payload: { peerId: remoteId } });
    }
  };

  const handleStream = (remoteId, remoteStream) => {
    emitter.emit("stream", { peerId: remoteId, stream: remoteStream });
  };

  const ensureMediaCall = (remoteId) => {
    if (!peer || !stream || calls.has(remoteId)) return;
    if (!shouldInitiateConnection(peerId, remoteId)) return;
    const call = peer.call(remoteId, stream);
    attachCall(call);
  };

  const connectToPeer = (remoteId) => {
    if (!peer || !remoteId || remoteId === peerId || connections.has(remoteId)) return;
    if (!shouldInitiateConnection(peerId, remoteId)) return;
    const conn = peer.connect(remoteId, { reliable: true });
    attachDataConnection(conn);
    ensureMediaCall(remoteId);
  };

  const handleRoster = (peers, nextRoomName) => {
    peers.forEach((entry) => {
      roster.set(entry.peerId, entry.displayName);
    });
    emitter.emit("roster", { peers, roomName: nextRoomName ?? roomName ?? null });
    peers.forEach((entry) => {
      if (entry.peerId === peerId) return;
      connectToPeer(entry.peerId);
      ensureMediaCall(entry.peerId);
    });
  };

  const handleJoin = (remoteId, name) => {
    roster.set(remoteId, name);
    const peers = Array.from(roster.entries()).map(([id, displayName]) => ({
      peerId: id,
      displayName
    }));
    safeSend(connections.get(remoteId), {
      type: "roster",
      payload: { peers, roomName: roomName ?? null }
    });
    broadcast({
      type: "peer-joined",
      payload: { peerId: remoteId, displayName: name }
    });
    ensureMediaCall(remoteId);
    emitter.emit("peer-joined", { peerId: remoteId, displayName: name });
  };

  const handleMessage = (data, sourceId) => {
    if (!data || typeof data !== "object") return;
    const { type, payload } = data;
    if (!type) return;
    switch (type) {
      case "join":
        if (!isHost || !payload) return;
        handleJoin(payload.peerId, payload.displayName);
        break;
      case "roster":
        if (!payload || !payload.peers) return;
        handleRoster(payload.peers, payload.roomName);
        break;
      case "peer-joined":
        if (!payload) return;
        roster.set(payload.peerId, payload.displayName);
        emitter.emit("peer-joined", payload);
        connectToPeer(payload.peerId);
        ensureMediaCall(payload.peerId);
        break;
      case "peer-left":
        if (!payload) return;
        handlePeerLeft(payload.peerId);
        break;
      case "chat":
        if (!payload) return;
        emitter.emit("chat", payload);
        break;
      case "caption":
        if (!payload) return;
        emitter.emit("caption", payload);
        break;
      case "navigate":
        if (!payload) return;
        emitter.emit("navigate", payload);
        break;
      default:
        log("Unhandled message", data, sourceId);
    }
  };

  const attachDataConnection = (conn) => {
    if (!conn) return;
    conn.on("open", () => {
      if (connections.has(conn.peer)) {
        conn.close();
        return;
      }
      connections.set(conn.peer, conn);
      log("Data channel open", conn.peer);
    });
    conn.on("data", (data) => handleMessage(data, conn.peer));
    conn.on("close", () => handlePeerLeft(conn.peer));
    conn.on("error", (err) => emitter.emit("error", { message: "data-connection", detail: err }));
  };

  const attachCall = (call) => {
    if (!call) return;
    const remoteId = call.peer;
    if (calls.has(remoteId)) {
      call.close();
      return;
    }
    calls.set(remoteId, call);
    call.on("stream", (remoteStream) => handleStream(remoteId, remoteStream));
    call.on("close", () => handlePeerLeft(remoteId));
    call.on("error", (err) => emitter.emit("error", { message: "media-call", detail: err }));
  };

  const connectToHost = () => {
    if (!peer || !roomId) return;
    const conn = peer.connect(roomId, { reliable: true });
    attachDataConnection(conn);
    conn.on("open", () => {
      safeSend(conn, {
        type: "join",
        payload: { peerId, displayName }
      });
    });
  };

  const bindPeer = (nextPeer) => {
    peer = nextPeer;
    peer.on("open", (id) => {
      peerId = id;
      isHost = id === roomId;
      roster.set(id, displayName);
      emitter.emit("ready", { peerId: id, isHost, roomName: roomName ?? null });
      if (!isHost) {
        connectToHost();
      }
    });
    peer.on("connection", (conn) => attachDataConnection(conn));
    peer.on("call", (call) => {
      if (stream) {
        call.answer(stream);
      } else {
        call.answer();
      }
      attachCall(call);
    });
    peer.on("disconnected", () =>
      emitter.emit("error", { message: "peer-disconnected" })
    );
    peer.on("close", () => emitter.emit("error", { message: "peer-closed" }));
    peer.on("error", (err) => {
      if (err?.type === "unavailable-id" && !destroyed) {
        log("Room host taken, switching to client id.");
        peer.destroy();
        bindPeer(new window.Peer(undefined, DEFAULT_PEER_OPTIONS));
        return;
      }
      emitter.emit("error", { message: "peer-error", detail: err });
    });
  };

  if (!window.Peer) {
    throw new Error("PeerJS not loaded. Ensure /peerjs.js is included.");
  }

  bindPeer(new window.Peer(roomId, DEFAULT_PEER_OPTIONS));

  return {
    on: emitter.on,
    sendChat: (message) => {
      if (!peerId) return;
      const payload =
        typeof message === "string" ? { text: message } : { ...message };
      broadcast({
        type: "chat",
        payload: { peerId, displayName, timestamp: Date.now(), ...payload }
      });
    },
    sendCaption: (text) => {
      if (!peerId) return;
      const payload = { peerId, displayName, text, timestamp: Date.now() };
      broadcast({ type: "caption", payload });
    },
    sendNavigate: (payload) => {
      if (!peerId) return;
      broadcast({ type: "navigate", payload: { ...payload, from: peerId } });
    },
    disconnect: () => {
      destroyed = true;
      connections.forEach((conn) => conn.close());
      calls.forEach((call) => call.close());
      connections.clear();
      calls.clear();
      if (peer) {
        peer.destroy();
      }
    }
  };
};
