import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import Modal from "../ui/components/Modal";
import SessionVideo from "../session/SessionVideo";
import { useSession } from "../session/SessionContext";
import { getDocById, getSetting, saveDocContent } from "../vault/queries";
import type { Doc } from "../vault/types";
import { createId } from "../lib/id";
import { sendPromptToProvider, type AiProvider } from "../ai/client";

const formatTimestamp = (timestamp: number) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const buildSummaryBlock = (summary: string) => {
  const date = new Date();
  const label = date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
  return `\n\n## Session Summary — ${label}\n\n${summary.trim()}\n`;
};

export default function SessionPage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const derivedRoomName = useMemo(
    () => (roomId ? decodeURIComponent(roomId) : "Session"),
    [roomId]
  );

  const {
    joined,
    joining,
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
    sendChatInput
  } = useSession();

  const [chatDraft, setChatDraft] = useState("");
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState("");
  const [lastDoc, setLastDoc] = useState<Doc | null>(null);
  const [entryError, setEntryError] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const [aiNotesLoading, setAiNotesLoading] = useState(false);
  const [lobbyRoomInput, setLobbyRoomInput] = useState("");
  const [newRoomId, setNewRoomId] = useState(() => createId().slice(0, 8));
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");

  useEffect(() => {
    if (joined) return;
    const params = new URLSearchParams(location.search);
    const provided = params.get("name");
    setRoomName(provided ? decodeURIComponent(provided) : derivedRoomName);
  }, [derivedRoomName, joined, location.search, setRoomName]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const lastDocId = window.localStorage.getItem("wb:lastDocId");
    if (!lastDocId) {
      setLastDoc(null);
      return;
    }
    getDocById(lastDocId)
      .then((doc) => setLastDoc(doc ?? null))
      .catch(() => setLastDoc(null));
  }, [summaryOpen]);

  const handleJoin = async () => {
    if (!roomId) return;
    if (!displayName.trim()) {
      setEntryError("Add a display name to join the table.");
      return;
    }
    setEntryError(null);
    await joinSession({ roomId, roomName, displayName: displayName.trim() });
  };

  const handleLeave = () => {
    leaveSession();
    if (lastDoc) {
      setSummaryOpen(true);
    } else {
      navigate("/");
    }
  };

  const handleSendChat = (event?: React.FormEvent) => {
    event?.preventDefault();
    const trimmed = chatDraft.trim();
    if (!trimmed) return;
    sendChatInput(trimmed);
    setChatDraft("");
  };

  const handlePinCaption = (caption: {
    displayName: string;
    text: string;
    timestamp: number;
  }) => {
    const line = `- ${formatTimestamp(caption.timestamp)} — **${caption.displayName}**: ${caption.text}`;
    const trimmed = notesDraft.trimEnd();
    const next = trimmed ? `${trimmed}\n${line}\n` : `${line}\n`;
    setNotesDraft(next);
  };

  const handleSaveSummary = async () => {
    if (!lastDoc) {
      setSummaryOpen(false);
      navigate("/");
      return;
    }
    if (!summaryDraft.trim()) {
      setSummaryOpen(false);
      navigate("/");
      return;
    }
    const nextBody = `${lastDoc.body}${buildSummaryBlock(summaryDraft)}`;
    // TODO: Persist summaries in Supabase once session history is synced.
    await saveDocContent(lastDoc.id, nextBody);
    setSummaryOpen(false);
    navigate(`/doc/${lastDoc.id}`);
  };

  const parseRoomInput = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return "";
    try {
      const parsed = new URL(trimmed);
      const parts = parsed.pathname.split("/").filter(Boolean);
      const sessionIndex = parts.indexOf("session");
      if (sessionIndex >= 0 && parts[sessionIndex + 1]) {
        return decodeURIComponent(parts[sessionIndex + 1]);
      }
    } catch (error) {
      // Not a URL; fall back to raw text.
    }
    return trimmed;
  };

  const handleJoinFromLobby = () => {
    const nextRoomId = parseRoomInput(lobbyRoomInput);
    if (!nextRoomId) {
      setEntryError("Enter a room code or paste a session link.");
      return;
    }
    setEntryError(null);
    navigate(
      `/session/${encodeURIComponent(nextRoomId)}?name=${encodeURIComponent(roomName)}`
    );
  };

  const handleCreateRoom = () => {
    setEntryError(null);
    navigate(
      `/session/${encodeURIComponent(newRoomId)}?name=${encodeURIComponent(roomName)}`
    );
  };

  const handleCopyLink = async () => {
    if (!roomId && !newRoomId) return;
    const id = roomId ?? newRoomId;
    const url = `${window.location.origin}/session/${encodeURIComponent(id)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopyStatus("copied");
      window.setTimeout(() => setCopyStatus("idle"), 2000);
    } catch (error) {
      console.warn("[Session] Failed to copy link", error);
      setCopyStatus("error");
      window.setTimeout(() => setCopyStatus("idle"), 2000);
    }
  };

  const buildAiPrompt = (mode: "summary" | "notes") => {
    const noteText = notesDraft.trim() || "No notes yet.";
    const chatText = chatMessages
      .slice(-20)
      .map((message) => `${message.displayName}: ${message.text}`)
      .join("\n");
    const header =
      mode === "summary"
        ? "Summarize the session notes and chat in 5-8 concise bullets."
        : "Turn the notes and chat into clean session notes with headings.";
    const guidance =
      mode === "summary"
        ? "Focus on key events, NPCs, locations, decisions, and next steps."
        : "Use Markdown headings for Highlights, NPCs, Locations, Loot, and Next Steps.";
    return [
      "You are the session scribe for a tabletop RPG.",
      header,
      guidance,
      "Do not invent details that are not in the notes or chat.",
      "",
      "Notes:",
      noteText,
      "",
      "Chat:",
      chatText || "No chat messages yet."
    ].join("\n");
  };

  const runAiRequest = async (mode: "summary" | "notes") => {
    setAiError(null);
    if (mode === "summary") {
      setAiSummaryLoading(true);
    } else {
      setAiNotesLoading(true);
    }
    try {
      const [
        providerSetting,
        openAiKey,
        openAiModel,
        openAiBaseUrl,
        ollamaModel,
        ollamaBaseUrl
      ] = await Promise.all([
        getSetting("aiProvider"),
        getSetting("aiOpenAiKey"),
        getSetting("aiOpenAiModel"),
        getSetting("aiOpenAiBaseUrl"),
        getSetting("aiOllamaModel"),
        getSetting("aiOllamaBaseUrl")
      ]);
      const provider = ((providerSetting ?? "none") as AiProvider) || "none";
      const prompt = buildAiPrompt(mode);
      const response = await sendPromptToProvider({
        provider,
        prompt,
        settings: {
          openAiKey,
          openAiModel,
          openAiBaseUrl,
          ollamaModel,
          ollamaBaseUrl
        }
      });
      if (mode === "summary") {
        setSummaryDraft(response.content);
        setSummaryOpen(true);
      } else {
        const dateLabel = new Date().toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric"
        });
        const block = `\n\n## AI Notes — ${dateLabel}\n\n${response.content.trim()}\n`;
        setNotesDraft((current) => `${current.trimEnd()}${block}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI request failed.";
      setAiError(message);
    } finally {
      if (mode === "summary") {
        setAiSummaryLoading(false);
      } else {
        setAiNotesLoading(false);
      }
    }
  };

  if (!roomId) {
    return (
      <div className="min-h-screen px-6 py-12">
        <div className="mx-auto max-w-4xl page-panel p-8 session-reveal">
          <div className="flex flex-col gap-8">
            <header className="space-y-2 text-center">
              <p className="text-xs font-ui uppercase tracking-[0.3em] text-ink-soft">
                Session Lobby
              </p>
              <h1 className="text-3xl font-display text-ink">
                Start or join a table.
              </h1>
              <p className="text-sm text-ink-soft">
                Share a room link for audio, captions, and shared notes.
              </p>
            </header>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-page-edge bg-parchment/70 p-6">
                <h2 className="text-sm font-ui uppercase tracking-[0.2em] text-ink-soft">
                  Create Room
                </h2>
                <label className="mt-4 block text-xs font-ui uppercase tracking-[0.2em] text-ink-soft">
                  Room Name
                  <input
                    value={roomName}
                    onChange={(event) => setRoomName(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-page-edge bg-parchment/80 px-4 py-3 text-sm font-body text-ink"
                  />
                </label>
                <label className="mt-4 block text-xs font-ui uppercase tracking-[0.2em] text-ink-soft">
                  Room Code
                  <input
                    value={newRoomId}
                    onChange={(event) => setNewRoomId(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-page-edge bg-parchment/80 px-4 py-3 text-sm font-body text-ink"
                  />
                </label>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => setNewRoomId(createId().slice(0, 8))}
                    className="rounded-full border border-page-edge px-4 py-2 text-xs font-ui uppercase tracking-[0.2em] text-ink-soft hover:text-ember"
                  >
                    Generate Code
                  </button>
                  <button
                    onClick={handleCreateRoom}
                    className="rounded-full border border-page-edge px-4 py-2 text-xs font-ui uppercase tracking-[0.2em] text-ink-soft hover:text-ember"
                  >
                    Create & Join
                  </button>
                  <button
                    onClick={handleCopyLink}
                    className="rounded-full border border-page-edge px-4 py-2 text-xs font-ui uppercase tracking-[0.2em] text-ink-soft hover:text-ember"
                  >
                    {copyStatus === "copied"
                      ? "Link Copied"
                      : copyStatus === "error"
                      ? "Copy Failed"
                      : "Copy Link"}
                  </button>
                </div>
              </div>
              <div className="rounded-2xl border border-page-edge bg-parchment/70 p-6">
                <h2 className="text-sm font-ui uppercase tracking-[0.2em] text-ink-soft">
                  Join Room
                </h2>
                <label className="mt-4 block text-xs font-ui uppercase tracking-[0.2em] text-ink-soft">
                  Room Code or Link
                  <input
                    value={lobbyRoomInput}
                    onChange={(event) => setLobbyRoomInput(event.target.value)}
                    placeholder="Paste a session link or room code"
                    className="mt-2 w-full rounded-xl border border-page-edge bg-parchment/80 px-4 py-3 text-sm font-body text-ink"
                  />
                </label>
                <label className="mt-4 block text-xs font-ui uppercase tracking-[0.2em] text-ink-soft">
                  Display Name
                  <input
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder="Your name at the table"
                    className="mt-2 w-full rounded-xl border border-page-edge bg-parchment/80 px-4 py-3 text-sm font-body text-ink"
                  />
                </label>
                {entryError ? (
                  <div className="mt-4 rounded-xl border border-ember/30 bg-ember/10 px-4 py-3 text-sm text-ink">
                    {entryError}
                  </div>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={handleJoinFromLobby}
                    className="rounded-full border border-page-edge px-4 py-2 text-xs font-ui uppercase tracking-[0.2em] text-ink-soft hover:text-ember"
                  >
                    Join Session
                  </button>
                </div>
              </div>
            </div>
            <p className="text-xs text-ink-soft text-center">
              Audio + captions require browser mic permissions.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!joined) {
    return (
      <div className="min-h-screen px-6 py-12">
        <div className="mx-auto max-w-3xl page-panel p-8 session-reveal">
          <div className="flex flex-col gap-6">
            <header className="space-y-2">
              <p className="text-xs font-ui uppercase tracking-[0.3em] text-ink-soft">
                Session Play
              </p>
              <h1 className="text-3xl font-display text-ink">
                Gather the table.
              </h1>
              <p className="text-sm text-ink-soft">
                Enter a room name and the name you want players to see.
              </p>
            </header>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-xs font-ui uppercase tracking-[0.2em] text-ink-soft">
                Room Name
                <input
                  value={roomName}
                  onChange={(event) => setRoomName(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-page-edge bg-parchment/80 px-4 py-3 text-sm font-body text-ink"
                />
              </label>
              <label className="space-y-2 text-xs font-ui uppercase tracking-[0.2em] text-ink-soft">
                Display Name
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Your name at the table"
                  className="mt-2 w-full rounded-xl border border-page-edge bg-parchment/80 px-4 py-3 text-sm font-body text-ink"
                />
              </label>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-xs font-ui uppercase tracking-[0.2em] text-ink-soft">
                Microphone
                <select
                  value={selectedAudioId}
                  onChange={(event) => setSelectedAudioId(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-page-edge bg-parchment/80 px-4 py-3 text-sm font-body text-ink"
                >
                  {audioInputs.length === 0 ? (
                    <option value="">No microphones found</option>
                  ) : (
                    audioInputs.map((device, index) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || `Microphone ${index + 1}`}
                      </option>
                    ))
                  )}
                </select>
              </label>
              <label className="space-y-2 text-xs font-ui uppercase tracking-[0.2em] text-ink-soft">
                Camera
                <select
                  value={selectedVideoId}
                  onChange={(event) => setSelectedVideoId(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-page-edge bg-parchment/80 px-4 py-3 text-sm font-body text-ink"
                >
                  {videoInputs.length === 0 ? (
                    <option value="">No cameras found</option>
                  ) : (
                    videoInputs.map((device, index) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || `Camera ${index + 1}`}
                      </option>
                    ))
                  )}
                </select>
              </label>
            </div>
            {entryError ? (
              <div className="rounded-xl border border-ember/30 bg-ember/10 px-4 py-3 text-sm text-ink">
                {entryError}
              </div>
            ) : null}
            {errorMessage ? (
              <div className="rounded-xl border border-ember/30 bg-ember/10 px-4 py-3 text-sm text-ink">
                {errorMessage}
              </div>
            ) : null}
            {connectionStatus ? (
              <div className="rounded-xl border border-page-edge bg-parchment/70 px-4 py-3 text-xs uppercase tracking-[0.2em] text-ink-soft">
                {connectionStatus}
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleJoin}
                disabled={joining || !displayName.trim()}
                className="rounded-full border border-page-edge px-6 py-3 text-xs font-ui uppercase tracking-[0.24em] text-ink-soft hover:text-ember disabled:cursor-not-allowed disabled:opacity-60"
              >
                {joining ? "Calling the Table..." : "Join Session"}
              </button>
              <div className="flex flex-wrap items-center gap-2 text-[0.6rem] uppercase tracking-[0.2em] text-ink-soft">
                <button
                  onClick={() => setMediaMode("av")}
                  className={`rounded-full border px-3 py-2 ${
                    mediaMode === "av"
                      ? "border-ember text-ember"
                      : "border-page-edge text-ink-soft"
                  }`}
                >
                  Audio + Video
                </button>
                <button
                  onClick={() => setMediaMode("audio")}
                  className={`rounded-full border px-3 py-2 ${
                    mediaMode === "audio"
                      ? "border-ember text-ember"
                      : "border-page-edge text-ink-soft"
                  }`}
                >
                  Audio Only
                </button>
                <button
                  onClick={() => setMediaMode("video")}
                  className={`rounded-full border px-3 py-2 ${
                    mediaMode === "video"
                      ? "border-ember text-ember"
                      : "border-page-edge text-ink-soft"
                  }`}
                >
                  Video Only
                </button>
              </div>
              <span className="text-xs text-ink-soft">
                Room ID: <span className="font-semibold">{roomId}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-6 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-ui uppercase tracking-[0.3em] text-ink-soft">
              Session Play
            </p>
            <h1 className="text-2xl font-display text-ink">{roomName}</h1>
            <p className="text-xs text-ink-soft">Room ID: {roomId}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={toggleMute} className="session-control-button">
              {muted ? "Unmute" : "Mute"}
            </button>
            <button onClick={toggleCamera} className="session-control-button">
              {cameraOff ? "Camera On" : "Camera Off"}
            </button>
            <button onClick={handleLeave} className="session-control-button">
              Leave Session
            </button>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {participants.map((participant) => (
                <div key={participant.id} className="session-frame session-reveal">
                  <div className="session-frame-inner">
                    <SessionVideo
                      stream={participant.stream}
                      muted={participant.isLocal}
                      placeholder="Waiting for video"
                    />
                  </div>
                  <div className="session-nameplate">
                    <span>{participant.displayName}</span>
                  </div>
                  {participant.isLocal && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button onClick={toggleMute} className="session-control-button">
                        {muted ? "Unmute Mic" : "Mute Mic"}
                      </button>
                      <button onClick={toggleCamera} className="session-control-button">
                        {cameraOff ? "Camera On" : "Camera Off"}
                      </button>
                    </div>
                  )}
                  <div className="session-captions">
                    {participant.captions.length === 0 ? (
                      <div className="text-xs text-ink-soft/70">
                        {supportsCaptions
                          ? "Captions will appear here."
                          : "Captions unavailable in this browser."}
                      </div>
                    ) : (
                      participant.captions.map((caption) => (
                        <div key={caption.id} className="session-caption-line">
                          <span className="session-caption-time">
                            {formatTimestamp(caption.timestamp)}
                          </span>
                          <span className="session-caption-text">
                            {caption.text}
                          </span>
                          <button
                            onClick={() => handlePinCaption(caption)}
                            className="session-caption-pin"
                          >
                            Pin to Notes
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
            {errorMessage ? (
              <div className="rounded-xl border border-ember/30 bg-ember/10 px-4 py-3 text-sm text-ink">
                {errorMessage}
              </div>
            ) : null}
          </div>

          <aside className="flex flex-col gap-4">
            <div className="session-panel session-reveal">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-ui uppercase tracking-[0.2em] text-ink-soft">
                  Session Notes
                </h2>
                <span className="text-[0.65rem] uppercase tracking-[0.3em] text-ink-soft">
                  Local
                </span>
              </div>
              <textarea
                value={notesDraft}
                onChange={(event) => setNotesDraft(event.target.value)}
                placeholder="Scribble notes, link [[Places]], capture what the world reveals."
                className="mt-3 h-56 w-full resize-none rounded-xl border border-page-edge bg-parchment/70 px-4 py-3 text-sm font-body text-ink"
              />
              {aiError ? (
                <div className="mt-3 rounded-xl border border-ember/30 bg-ember/10 px-4 py-3 text-xs text-ink">
                  {aiError}
                </div>
              ) : null}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => runAiRequest("notes")}
                  disabled={aiNotesLoading}
                  className="rounded-full border border-page-edge px-4 py-2 text-[0.6rem] font-ui uppercase tracking-[0.2em] text-ink-soft hover:text-ember disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {aiNotesLoading ? "Drafting Notes..." : "AI Notes"}
                </button>
                <button
                  onClick={() => runAiRequest("summary")}
                  disabled={aiSummaryLoading}
                  className="rounded-full border border-page-edge px-4 py-2 text-[0.6rem] font-ui uppercase tracking-[0.2em] text-ink-soft hover:text-ember disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {aiSummaryLoading ? "Summarizing..." : "AI Summary"}
                </button>
              </div>
              <p className="mt-2 text-xs text-ink-soft">
                Markdown and wikilinks are supported. Notes stay on this device.
              </p>
            </div>

            <div className="session-panel session-reveal">
              <h2 className="text-sm font-ui uppercase tracking-[0.2em] text-ink-soft">
                Table Chat
              </h2>
              <div className="mt-3 space-y-2">
                {chatMessages.length === 0 ? (
                  <p className="text-xs text-ink-soft">
                    Quiet air. Drop a quick note here.
                  </p>
                ) : (
                  chatMessages.map((message) => (
                    <div key={message.id} className="session-scrap">
                      <div className="flex items-center justify-between text-[0.6rem] uppercase tracking-[0.2em] text-ink-soft">
                        <span>{message.displayName}</span>
                        <span>{formatTimestamp(message.timestamp)}</span>
                      </div>
                      {message.roll ? (
                        <div className="mt-2 space-y-1 text-sm text-ink">
                          <div className="session-roll-line">
                            <span className="session-roll-label">Roll</span>
                            <span>{message.roll.expression}</span>
                          </div>
                          <div className="session-roll-line">
                            <span className="session-roll-label">Total</span>
                            <span>{message.roll.total}</span>
                          </div>
                          <div className="session-roll-breakdown">
                            {message.roll.breakdown}
                          </div>
                        </div>
                      ) : (
                        <p className="mt-1 text-sm text-ink">{message.text}</p>
                      )}
                    </div>
                  ))
                )}
              </div>
              <form onSubmit={handleSendChat} className="mt-3 flex gap-2">
                <input
                  value={chatDraft}
                  onChange={(event) => setChatDraft(event.target.value)}
                  placeholder="Write a quick note or /roll 1d20+5"
                  className="flex-1 rounded-full border border-page-edge bg-parchment/80 px-4 py-2 text-sm text-ink"
                />
                <button
                  type="submit"
                  className="rounded-full border border-page-edge px-4 py-2 text-xs font-ui uppercase tracking-[0.2em] text-ink-soft hover:text-ember"
                >
                  Send
                </button>
              </form>
            </div>
          </aside>
        </div>
      </div>

      <Modal
        isOpen={summaryOpen}
        title="Add session summary to current doc?"
        onClose={() => {
          setSummaryOpen(false);
          navigate("/");
        }}
      >
        <p className="text-sm text-ink-soft">
          {lastDoc
            ? `Append a summary to "${lastDoc.title}".`
            : "No recent document found."}
        </p>
        <textarea
          value={summaryDraft}
          onChange={(event) => setSummaryDraft(event.target.value)}
          placeholder="What changed in the world? What should the vault remember?"
          className="h-40 w-full resize-none rounded-xl border border-page-edge bg-parchment/80 px-4 py-3 text-sm text-ink"
        />
        <div className="flex flex-wrap justify-end gap-2">
          <button
            onClick={() => {
              setSummaryOpen(false);
              navigate("/");
            }}
            className="rounded-full border border-page-edge px-4 py-2 text-xs font-ui uppercase tracking-[0.2em] text-ink-soft hover:text-ember"
          >
            Skip
          </button>
          <button
            onClick={handleSaveSummary}
            className="rounded-full border border-page-edge px-4 py-2 text-xs font-ui uppercase tracking-[0.2em] text-ink-soft hover:text-ember"
          >
            Add Summary
          </button>
        </div>
      </Modal>
    </div>
  );
}
