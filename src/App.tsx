import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { AssetsPage } from "@/pages/AssetsPage";
import { HomePage } from "@/pages/HomePage";
import { WorkspacePage } from "@/pages/WorkspacePage";

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />
        <Route path="/assets" element={<AssetsPage />} />
        <Route path="/workspace/:taskId" element={<WorkspacePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
