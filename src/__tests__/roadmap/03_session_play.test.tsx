import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import SessionPage from "../../pages/SessionPage";

vi.mock("../../session/SessionVideo", () => ({
  default: () => <div data-testid="session-video" />
}));

vi.mock("../../session/SessionContext", () => ({
  useSession: () => ({
    joined: false,
    joining: false,
    roomId: null,
    roomName: "Session",
    displayName: "",
    participants: [],
    chatMessages: [],
    notesDraft: "",
    muted: false,
    cameraOff: false,
    connectionStatus: null,
    errorMessage: null,
    mediaMode: "av",
    audioInputs: [],
    videoInputs: [],
    selectedAudioId: "",
    selectedVideoId: "",
    supportsCaptions: true,
    lastNavigation: null,
    setRoomName: vi.fn(),
    setDisplayName: vi.fn(),
    setNotesDraft: vi.fn(),
    setMediaMode: vi.fn(),
    setSelectedAudioId: vi.fn(),
    setSelectedVideoId: vi.fn(),
    joinSession: vi.fn(),
    leaveSession: vi.fn(),
    toggleMute: vi.fn(),
    toggleCamera: vi.fn(),
    sendChatInput: vi.fn(),
    sendNavigate: vi.fn()
  })
}));

vi.mock("../../vault/queries", () => ({
  getDocById: vi.fn().mockResolvedValue(null),
  getSetting: vi.fn().mockResolvedValue(null),
  saveDocContent: vi.fn().mockResolvedValue(undefined)
}));

vi.mock("../../ai/client", () => ({
  sendPromptToProvider: vi.fn().mockResolvedValue({ content: "" })
}));

describe("roadmap/03 session play - lobby UI", () => {
  it("renders the entry prompt and lobby inputs", () => {
    render(
      <MemoryRouter initialEntries={["/session"]}>
        <SessionPage />
      </MemoryRouter>
    );

    expect(screen.getByText("Start or join a table.")).toBeInTheDocument();
    expect(
      screen.getByText("Share a room link for audio, captions, and shared notes.")
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Paste a session link or room code")
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Your name at the table")).toBeInTheDocument();
  });
});
