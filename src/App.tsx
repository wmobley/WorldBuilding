import { Route, Routes } from "react-router-dom";
import VaultPage from "./pages/VaultPage";
import ReferencePage from "./pages/ReferencePage";
import TimelinePage from "./pages/TimelinePage";
import MapsPage from "./pages/MapsPage";
import SettingsPage from "./pages/SettingsPage";
import SessionPage from "./pages/SessionPage";
import SessionDock from "./session/SessionDock";

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<VaultPage />} />
        <Route path="/doc/:docId" element={<VaultPage />} />
        <Route path="/folder/:folderName" element={<VaultPage />} />
        <Route path="/trash" element={<VaultPage />} />
        <Route path="/timeline" element={<TimelinePage />} />
        <Route path="/maps" element={<MapsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/reference/:slug" element={<ReferencePage />} />
        <Route path="/session/:roomId" element={<SessionPage />} />
      </Routes>
      <SessionDock />
    </>
  );
}
