import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/navigation/Sidebar";
import { useBootstrap } from "@/hooks/useBootstrap";

export function AppShell() {
  useBootstrap();

  return (
    <div className="min-h-screen bg-mist px-4 py-4 text-ink lg:px-5">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-[1600px] gap-4">
        <Sidebar />
        <main className="flex-1 rounded-[28px] border border-line/80 bg-white/70 p-3 shadow-panel backdrop-blur-sm">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
