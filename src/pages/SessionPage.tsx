import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Modal from "../ui/components/Modal";
import SessionVideo from "../session/SessionVideo";
import { useSession } from "../session/SessionContext";
import { getDocById, saveDocContent } from "../vault/queries";
import type { Doc } from "../vault/types";

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

  useEffect(() => {
    if (joined) return;
    setRoomName(derivedRoomName);
  }, [derivedRoomName, joined, setRoomName]);

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

  if (!roomId) {
    return (
      <div className="min-h-screen px-6 py-12">
        <div className="mx-auto max-w-3xl page-panel p-8 text-center">
          <h1 className="text-2xl font-display text-ink">
            Session room not found.
          </h1>
          <p className="mt-3 text-sm text-ink-soft">
            Check the session link and try again.
          </p>
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
