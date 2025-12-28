import { Route, Routes } from "react-router-dom";
import VaultPage from "./pages/VaultPage";
import ReferencePage from "./pages/ReferencePage";
import TimelinePage from "./pages/TimelinePage";
import MapsPage from "./pages/MapsPage";
import SettingsPage from "./pages/SettingsPage";
import SessionPage from "./pages/SessionPage";
import SessionDock from "./session/SessionDock";
import AuthGate from "./auth/AuthGate";
import CampaignSettingsPage from "./pages/CampaignSettingsPage";
import PlayerViewPage from "./pages/PlayerViewPage";
import InvitePage from "./pages/InvitePage";

export default function App() {
  return (
    <AuthGate>
      <Routes>
        <Route path="/" element={<VaultPage />} />
        <Route path="/doc/:docId" element={<VaultPage />} />
        <Route path="/folder/:folderName" element={<VaultPage />} />
        <Route path="/trash" element={<VaultPage />} />
        <Route path="/timeline" element={<TimelinePage />} />
        <Route path="/maps" element={<MapsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/campaign/:id/settings" element={<CampaignSettingsPage />} />
        <Route path="/campaign/:id/player" element={<PlayerViewPage />} />
        <Route path="/invite/:inviteId" element={<InvitePage />} />
        <Route path="/reference/:slug" element={<ReferencePage />} />
        <Route path="/session" element={<SessionPage />} />
        <Route path="/session/:roomId" element={<SessionPage />} />
      </Routes>
      <SessionDock />
    </AuthGate>
  );
}
