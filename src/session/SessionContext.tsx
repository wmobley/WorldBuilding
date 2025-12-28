import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { createId } from "../lib/id";
import { createWebConnectRoom } from "../lib/webConnect";
import type { WebConnectPeer } from "../lib/webConnect";
import { rollDiceExpression } from "../lib/diceRoller";
import { useDebouncedCallback } from "../lib/useDebouncedCallback";
import { getSessionNotes, getSetting, saveSessionNotes } from "../vault/queries";
import type { SessionNotes } from "../vault/types";

type CaptionChunk = {
  id: string;
  peerId: string;
  displayName: string;
  text: string;
  timestamp: number;
};

type Participant = {
  id: string;
  displayName: string;
  stream: MediaStream | null;
  isLocal: boolean;
  captions: CaptionChunk[];
};

type ChatMessage = {
  id: string;
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

type NavigationNotice = {
  path: string;
  label: string;
  timestamp: number;
};

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0?: { transcript?: string };
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

const getSpeechRecognition = () => {
  const win = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return win.SpeechRecognition ?? win.webkitSpeechRecognition;
};

const buildLocalNotesKey = (roomId: string) => `wb:sessionNotes:${roomId}`;

const readLocalNotes = (roomId: string) => {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(buildLocalNotesKey(roomId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { content?: string; updatedAt?: number };
    if (typeof parsed.content !== "string") return null;
    return {
      content: parsed.content,
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : 0
    };
  } catch (error) {
    console.warn("[Session] Failed to read local notes", error);
    return null;
  }
};

type JoinPayload = {
  roomId: string;
  roomName: string;
  displayName: string;
};

type SessionContextValue = {
  joined: boolean;
  joining: boolean;
  roomId: string | null;
  roomName: string;
  displayName: string;
  participants: Participant[];
  chatMessages: ChatMessage[];
  notesDraft: string;
  muted: boolean;
  cameraOff: boolean;
  connectionStatus: string | null;
  errorMessage: string | null;
  mediaMode: "av" | "audio" | "video";
  audioInputs: MediaDeviceInfo[];
  videoInputs: MediaDeviceInfo[];
  selectedAudioId: string;
  selectedVideoId: string;
  supportsCaptions: boolean;
  lastNavigation: NavigationNotice | null;
  setRoomName: (name: string) => void;
  setDisplayName: (name: string) => void;
  setNotesDraft: (value: string) => void;
  setMediaMode: (mode: "av" | "audio" | "video") => void;
  setSelectedAudioId: (id: string) => void;
  setSelectedVideoId: (id: string) => void;
  joinSession: (payload: JoinPayload) => Promise<void>;
  leaveSession: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  sendChatInput: (raw: string) => void;
  sendNavigate: (payload: { path: string; label: string }) => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomName, setRoomName] = useState("Session");
  const [displayName, setDisplayName] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem("wb:sessionDisplayName") ?? "";
  });
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [notesDraft, setNotesDraft] = useState("");
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mediaMode, setMediaMode] = useState<"av" | "audio" | "video">("av");
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioId, setSelectedAudioId] = useState<string>("");
  const [selectedVideoId, setSelectedVideoId] = useState<string>("");
  const [lastNavigation, setLastNavigation] = useState<NavigationNotice | null>(null);
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);

  const roomRef = useRef<ReturnType<typeof createWebConnectRoom> | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const localPeerIdRef = useRef<string | null>(null);
  const notesHydratedRef = useRef(false);
  const localNotesUpdatedAtRef = useRef<number | null>(null);
  const mediaRequestIdRef = useRef(0);

  const supportsCaptions = Boolean(getSpeechRecognition());

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("wb:sessionDisplayName", displayName);
  }, [displayName]);

  useEffect(() => {
    const loadCampaign = async () => {
      const stored = await getSetting("activeCampaignId");
      setActiveCampaignId(stored);
    };
    loadCampaign().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const loadDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audio = devices.filter((device) => device.kind === "audioinput");
        const video = devices.filter((device) => device.kind === "videoinput");
        setAudioInputs(audio);
        setVideoInputs(video);
        if (!selectedAudioId && audio.length > 0) {
          setSelectedAudioId(audio[0]?.deviceId ?? "");
        }
        if (!selectedVideoId && video.length > 0) {
          setSelectedVideoId(video[0]?.deviceId ?? "");
        }
      } catch (error) {
        console.warn("[Session] enumerateDevices failed", error);
      }
    };
    loadDevices().catch(() => undefined);
    navigator.mediaDevices.addEventListener("devicechange", loadDevices);
    return () => navigator.mediaDevices.removeEventListener("devicechange", loadDevices);
  }, [selectedAudioId, selectedVideoId]);

  useEffect(() => {
    notesHydratedRef.current = false;
    localNotesUpdatedAtRef.current = null;
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;
    const localNotes = readLocalNotes(roomId);
    if (localNotes && !notesHydratedRef.current) {
      setNotesDraft(localNotes.content);
      notesHydratedRef.current = true;
      localNotesUpdatedAtRef.current = localNotes.updatedAt;
    }
    getSessionNotes(roomId)
      .then((sessionNotes) => {
        if (!sessionNotes) {
          if (!notesHydratedRef.current) {
            setNotesDraft("");
          }
          return;
        }
        const localUpdatedAt = localNotesUpdatedAtRef.current ?? 0;
        if (!notesHydratedRef.current || sessionNotes.updatedAt > localUpdatedAt) {
          setNotesDraft(sessionNotes.content);
          notesHydratedRef.current = true;
          localNotesUpdatedAtRef.current = sessionNotes.updatedAt;
        }
      })
      .catch(() => undefined);
  }, [roomId]);

  const saveNotes = useDebouncedCallback((content: string) => {
    if (!roomId) return;
    const payload: Omit<SessionNotes, "roomId" | "createdAt"> = {
      roomName,
      campaignId: activeCampaignId,
      content,
      updatedAt: Date.now()
    };
    saveSessionNotes(roomId, payload).catch(() => undefined);
  }, 400);

  useEffect(() => {
    if (!roomId || !joined) return;
    saveNotes(notesDraft);
  }, [notesDraft, roomId, joined, saveNotes]);

  useEffect(() => {
    if (!roomId || !joined || typeof window === "undefined") return;
    const updatedAt = Date.now();
    window.localStorage.setItem(
      buildLocalNotesKey(roomId),
      JSON.stringify({ content: notesDraft, updatedAt })
    );
    localNotesUpdatedAtRef.current = updatedAt;
  }, [notesDraft, roomId, joined]);

  const addParticipant = (entry: Participant) => {
    setParticipants((current) => {
      const existing = current.find((participant) => participant.id === entry.id);
      if (existing) {
        return current.map((participant) =>
          participant.id === entry.id ? { ...participant, ...entry } : participant
        );
      }
      return [...current, entry];
    });
  };

  const removeParticipant = (peerId: string) => {
    setParticipants((current) =>
      current.filter((participant) => participant.id !== peerId)
    );
  };

  const addCaption = (chunk: CaptionChunk) => {
    setParticipants((current) =>
      current.map((participant) => {
        const localId = localPeerIdRef.current;
        const targetId = localId && chunk.peerId === localId ? "local" : chunk.peerId;
        if (participant.id !== targetId) return participant;
        const nextCaptions = [...participant.captions, chunk].slice(-4);
        return { ...participant, captions: nextCaptions };
      })
    );
  };

  const addChatMessage = (message: ChatMessage) => {
    setChatMessages((current) => [...current, message].slice(-120));
  };

  const startCaptioning = () => {
    const Recognition = getSpeechRecognition();
    if (!Recognition) return;
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (!result.isFinal) continue;
        const text = result[0]?.transcript?.trim();
        if (!text) continue;
        roomRef.current?.sendCaption(text);
        addCaption({
          id: createId(),
          peerId: localPeerIdRef.current ?? "local",
          displayName,
          text,
          timestamp: Date.now()
        });
      }
    };
    recognition.onend = () => {
      if (joined && !muted) {
        recognition.start();
      }
    };
    recognition.start();
    recognitionRef.current = recognition;
  };

  const stopCaptioning = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
  };

  const attachStreamControls = (stream: MediaStream) => {
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
    stream.getVideoTracks().forEach((track) => {
      track.enabled = !cameraOff;
    });
  };

  const releaseMedia = () => {
    stopCaptioning();
    roomRef.current?.disconnect();
    roomRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    localPeerIdRef.current = null;
    setParticipants([]);
    setChatMessages([]);
    setJoined(false);
  };

  useEffect(() => {
    window.addEventListener("beforeunload", releaseMedia);
    window.addEventListener("unload", releaseMedia);
    window.addEventListener("pagehide", releaseMedia);
    window.addEventListener("freeze", releaseMedia);

    return () => {
      window.removeEventListener("beforeunload", releaseMedia);
      window.removeEventListener("unload", releaseMedia);
      window.removeEventListener("pagehide", releaseMedia);
      window.removeEventListener("freeze", releaseMedia);
      releaseMedia();
    };
  }, []);

  useEffect(() => {
    if (!localStreamRef.current) return;
    attachStreamControls(localStreamRef.current);
    if (muted) {
      stopCaptioning();
    } else if (joined) {
      startCaptioning();
    }
  }, [muted, cameraOff, joined]);

  const joinSession = async (payload: JoinPayload) => {
    if (joining || joined) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorMessage("Camera or microphone access is not available.");
      return;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    setErrorMessage(null);
    setConnectionStatus("Requesting mic + camera...");
    setJoining(true);
    const requestId = (mediaRequestIdRef.current += 1);
    try {
      const audioConstraint =
        selectedAudioId && selectedAudioId !== "default"
          ? { deviceId: { ideal: selectedAudioId } }
          : true;
      const videoConstraint =
        selectedVideoId && selectedVideoId !== "default"
          ? { deviceId: { ideal: selectedVideoId } }
          : true;

      const requestMedia = async (
        constraints: MediaStreamConstraints,
        label: string
      ) => {
        const timeoutMs = 8000;
        let timeoutId: number | null = null;
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = window.setTimeout(() => {
            console.warn("[Session] Media request timed out");
            reject(new Error("media-timeout"));
          }, timeoutMs);
        });
        try {
          console.log(`[Session] Requesting ${label}`);
          const nextStream = (await Promise.race([
            navigator.mediaDevices.getUserMedia(constraints),
            timeoutPromise
          ])) as MediaStream;
          if (timeoutId) window.clearTimeout(timeoutId);
          if (requestId !== mediaRequestIdRef.current) {
            nextStream.getTracks().forEach((track) => track.stop());
            throw new Error("Media request cancelled");
          }
          return nextStream;
        } catch (error) {
          if (timeoutId) window.clearTimeout(timeoutId);
          throw error;
        }
      };

      let stream: MediaStream;
      try {
        if (mediaMode === "audio") {
          setConnectionStatus("Requesting microphone only...");
          stream = await requestMedia({ video: false, audio: audioConstraint }, "audio");
        } else if (mediaMode === "video") {
          setConnectionStatus("Requesting camera only...");
          stream = await requestMedia({ video: videoConstraint, audio: false }, "video");
        } else {
          stream = await requestMedia(
            { video: videoConstraint, audio: audioConstraint },
            "audio + video"
          );
        }
      } catch (error) {
        try {
          console.warn("[Session] Primary media request failed, retrying audio-only", error);
          setConnectionStatus("Retrying with audio only...");
          stream = await requestMedia({ video: false, audio: audioConstraint }, "audio");
        } catch (audioError) {
          console.warn("[Session] Audio request failed, retrying video-only", audioError);
          setConnectionStatus("Retrying with video only...");
          stream = await requestMedia({ video: videoConstraint, audio: false }, "video");
        }
      }

      if (requestId !== mediaRequestIdRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        setJoining(false);
        return;
      }

      localStreamRef.current = stream;
      attachStreamControls(stream);
      setParticipants([
        {
          id: "local",
          displayName: payload.displayName,
          stream,
          isLocal: true,
          captions: []
        }
      ]);

      setRoomId(payload.roomId);
      setRoomName(payload.roomName);
      setDisplayName(payload.displayName);

      let room: ReturnType<typeof createWebConnectRoom>;
      try {
        setConnectionStatus("Connecting to session host...");
        room = createWebConnectRoom({
          roomId: payload.roomId,
          displayName: payload.displayName,
          roomName: payload.roomName,
          stream
        });
      } catch (error) {
        setErrorMessage("Session networking could not start.");
        setJoining(false);
        setConnectionStatus(null);
        return;
      }

      room.on("ready", (readyPayload) => {
        localPeerIdRef.current = readyPayload.peerId;
        setConnectionStatus(`Connected as ${readyPayload.peerId}`);
        if (readyPayload.roomName && readyPayload.roomName !== payload.roomName) {
          setRoomName(readyPayload.roomName);
        }
      });

      room.on("roster", (rosterPayload) => {
        const peers = rosterPayload.peers ?? [];
        if (rosterPayload.roomName && rosterPayload.roomName !== payload.roomName) {
          setRoomName(rosterPayload.roomName);
        }
        peers.forEach((peer: WebConnectPeer) => {
          if (peer.peerId === localPeerIdRef.current) return;
          addParticipant({
            id: peer.peerId,
            displayName: peer.displayName,
            stream: null,
            isLocal: false,
            captions: []
          });
        });
      });

      room.on("peer-joined", (joinPayload) => {
        if (joinPayload.peerId === localPeerIdRef.current) return;
        addParticipant({
          id: joinPayload.peerId,
          displayName: joinPayload.displayName,
          stream: null,
          isLocal: false,
          captions: []
        });
      });

      room.on("peer-left", (leavePayload) => removeParticipant(leavePayload.peerId));

      room.on("stream", (streamPayload) => {
        setParticipants((current) => {
          const existing = current.find(
            (participant) => participant.id === streamPayload.peerId
          );
          if (existing) {
            return current.map((participant) =>
              participant.id === streamPayload.peerId
                ? { ...participant, stream: streamPayload.stream }
                : participant
            );
          }
          return [
            ...current,
            {
              id: streamPayload.peerId,
              displayName: "Traveler",
              stream: streamPayload.stream,
              isLocal: false,
              captions: []
            }
          ];
        });
      });

      room.on("chat", (chatPayload) => {
        addChatMessage({
          id: createId(),
          peerId: chatPayload.peerId,
          displayName: chatPayload.displayName,
          text: chatPayload.text,
          timestamp: chatPayload.timestamp,
          roll: chatPayload.roll
        });
      });

      room.on("caption", (captionPayload) => {
        addCaption({
          id: createId(),
          peerId: captionPayload.peerId,
          displayName: captionPayload.displayName,
          text: captionPayload.text,
          timestamp: captionPayload.timestamp
        });
      });

      room.on("navigate", (navPayload) => {
        if (!navPayload?.path) return;
        setLastNavigation({
          path: navPayload.path,
          label: navPayload.label ?? navPayload.path,
          timestamp: Date.now()
        });
        navigate(navPayload.path);
      });

      room.on("error", (payloadError) => {
        setErrorMessage(
          typeof payloadError?.message === "string"
            ? `Connection issue: ${payloadError.message}`
            : "Connection issue."
        );
        setConnectionStatus(null);
      });

      roomRef.current = room;
      setJoined(true);
      setJoining(false);
      setConnectionStatus("Awaiting peers...");
      if (!muted) {
        startCaptioning();
      }
    } catch (error) {
      console.error(error);
      setErrorMessage(
        "Media request failed. Check OS privacy permissions or close apps using the camera/mic."
      );
      setJoining(false);
      setConnectionStatus(null);
    }
  };

  const leaveSession = () => {
    releaseMedia();
    setRoomId(null);
    setConnectionStatus(null);
    setJoined(false);
  };

  const toggleMute = () => setMuted((current) => !current);
  const toggleCamera = () => setCameraOff((current) => !current);

  const sendChatInput = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    let text = trimmed;
    let roll;
    const rollCommandMatch = /^\/(roll|r)\s*/i.exec(trimmed);
    const rollExpression = rollCommandMatch
      ? trimmed.replace(/^\/(roll|r)\s*/i, "")
      : trimmed;
    const isDiceExpression =
      /d/i.test(rollExpression) && /^[0-9dD+\-]+$/.test(rollExpression);
    if (rollCommandMatch || isDiceExpression) {
      if (!rollExpression) {
        addChatMessage({
          id: createId(),
          peerId: "system",
          displayName: "Table",
          text: "Add a dice expression, e.g. /roll 1d20+5.",
          timestamp: Date.now()
        });
        return;
      }
      const result = rollDiceExpression(rollExpression);
      if (!result) {
        addChatMessage({
          id: createId(),
          peerId: "system",
          displayName: "Table",
          text: `Invalid roll: ${rollExpression}`,
          timestamp: Date.now()
        });
        return;
      }
      roll = result;
      text = `${result.expression} = ${result.total}`;
    }

    roomRef.current?.sendChat({ text, roll });
    addChatMessage({
      id: createId(),
      peerId: localPeerIdRef.current ?? "local",
      displayName,
      text,
      timestamp: Date.now(),
      roll
    });
  };

  const sendNavigate = (payload: { path: string; label: string }) => {
    if (!payload.path) return;
    roomRef.current?.sendNavigate(payload);
    setLastNavigation({ ...payload, timestamp: Date.now() });
  };

  const value = useMemo(
    () => ({
      joined,
      joining,
      roomId,
      roomName,
      displayName,
      participants,
      chatMessages,
      notesDraft,
      muted,
      cameraOff,
      connectionStatus,
      errorMessage,
      mediaMode,
      audioInputs,
      videoInputs,
      selectedAudioId,
      selectedVideoId,
      supportsCaptions,
      lastNavigation,
      setRoomName,
      setDisplayName,
      setNotesDraft,
      setMediaMode,
      setSelectedAudioId,
      setSelectedVideoId,
      joinSession,
      leaveSession,
      toggleMute,
      toggleCamera,
      sendChatInput,
      sendNavigate
    }),
    [
      joined,
      joining,
      roomId,
      roomName,
      displayName,
      participants,
      chatMessages,
      notesDraft,
      muted,
      cameraOff,
      connectionStatus,
      errorMessage,
      mediaMode,
      audioInputs,
      videoInputs,
      selectedAudioId,
      selectedVideoId,
      supportsCaptions,
      lastNavigation,
      joinSession,
      leaveSession,
      toggleMute,
      toggleCamera,
      sendChatInput,
      sendNavigate
    ]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within SessionProvider");
  }
  return context;
}
