import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import SessionVideo from "./SessionVideo";
import { useSession } from "./SessionContext";

const formatTimestamp = (timestamp: number) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

export default function SessionDock() {
  const location = useLocation();
  const {
    joined,
    participants,
    chatMessages,
    muted,
    cameraOff,
    roomName,
    toggleMute,
    toggleCamera,
    sendChatInput,
    sendNavigate,
    lastNavigation
  } = useSession();
  const [chatDraft, setChatDraft] = useState("");

  const isSessionRoute = location.pathname.startsWith("/session");
  const pathLabel = useMemo(() => {
    if (typeof document !== "undefined" && document.title) {
      return document.title;
    }
    return location.pathname;
  }, [location.pathname]);

  if (!joined || isSessionRoute) return null;

  const visibleParticipants = participants.slice(0, 4);

  const handleSendChat = (event?: React.FormEvent) => {
    event?.preventDefault();
    const trimmed = chatDraft.trim();
    if (!trimmed) return;
    sendChatInput(trimmed);
    setChatDraft("");
  };

  const handleSendPage = () => {
    const path = `${location.pathname}${location.search}`;
    sendNavigate({ path, label: pathLabel });
  };

  return (
    <div className="session-dock">
      <div className="session-dock-header">
        <div>
          <p className="session-dock-label">Session</p>
          <p className="session-dock-title">{roomName}</p>
        </div>
        <div className="session-dock-actions">
          <button onClick={toggleMute} className="session-dock-button">
            {muted ? "Unmute" : "Mute"}
          </button>
          <button onClick={toggleCamera} className="session-dock-button">
            {cameraOff ? "Camera On" : "Camera Off"}
          </button>
        </div>
      </div>
      <div className="session-dock-grid">
        {visibleParticipants.map((participant) => (
          <div key={participant.id} className="session-dock-frame">
            <SessionVideo
              stream={participant.stream}
              muted={participant.isLocal}
              placeholder={participant.displayName}
            />
            <div className="session-dock-name">{participant.displayName}</div>
            <div className="session-dock-captions">
              {participant.captions.slice(-2).map((caption) => (
                <div key={caption.id} className="session-dock-caption">
                  {caption.text}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="session-dock-chat">
        <div className="session-dock-chat-header">
          <span>Table Chat</span>
          <button onClick={handleSendPage} className="session-dock-button">
            Bring Table Here
          </button>
        </div>
        {lastNavigation ? (
          <div className="session-dock-nav">
            Jumped to {lastNavigation.label}
          </div>
        ) : null}
        <div className="session-dock-chat-list">
          {chatMessages.slice(-4).map((message) => (
            <div key={message.id} className="session-dock-chat-line">
              <span>{message.displayName}</span>
              <span>{formatTimestamp(message.timestamp)}</span>
              <div className="session-dock-chat-text">
                {message.roll ? message.roll.breakdown : message.text}
              </div>
            </div>
          ))}
        </div>
        <form onSubmit={handleSendChat} className="session-dock-chat-form">
          <input
            value={chatDraft}
            onChange={(event) => setChatDraft(event.target.value)}
            placeholder="/roll 1d20+5"
            className="session-dock-input"
          />
          <button type="submit" className="session-dock-button">
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
