import { useMemo } from "react";
import { Navigate, useParams } from "react-router-dom";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { useAppStore } from "@/store/appStore";

export function WorkspacePage() {
  const { taskId } = useParams<{ taskId: string }>();
  const tasks = useAppStore((state) => state.tasks);
  const allPages = useAppStore((state) => state.pages);
  const allPageVersions = useAppStore((state) => state.pageVersions);

  const task = useMemo(() => tasks.find((item) => item.id === taskId), [taskId, tasks]);
  const pages = useMemo(
    () => allPages.filter((page) => page.taskId === taskId).sort((a, b) => a.index - b.index),
    [allPages, taskId],
  );
  const pageVersions = useMemo(
    () => allPageVersions.filter((version) => version.taskId === taskId),
    [allPageVersions, taskId],
  );

  if (!taskId || !task) {
    return <Navigate to="/" replace />;
  }

  return <WorkspaceShell task={task} pages={pages} pageVersions={pageVersions} />;
}
