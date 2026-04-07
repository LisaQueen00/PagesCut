import { useMemo } from "react";
import { Navigate, useParams } from "react-router-dom";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { getOrderedCompositionPages } from "@/lib/finalComposition";
import { useAppStore } from "@/store/appStore";

export function WorkspacePage() {
  const { taskId } = useParams<{ taskId: string }>();
  const tasks = useAppStore((state) => state.tasks);
  const allPages = useAppStore((state) => state.pages);
  const allPackagingPages = useAppStore((state) => state.packagingPages);
  const allPageVersions = useAppStore((state) => state.pageVersions);
  const allFinalCompositions = useAppStore((state) => state.finalCompositions);
  const allFinalCompositionPages = useAppStore((state) => state.finalCompositionPages);

  const task = useMemo(() => tasks.find((item) => item.id === taskId), [taskId, tasks]);
  const pages = useMemo(
    () => allPages.filter((page) => page.taskId === taskId).sort((a, b) => a.index - b.index),
    [allPages, taskId],
  );
  const packagingPages = useMemo(
    () => allPackagingPages.filter((page) => page.taskId === taskId).sort((a, b) => a.index - b.index),
    [allPackagingPages, taskId],
  );
  const pageVersions = useMemo(
    () => allPageVersions.filter((version) => version.taskId === taskId),
    [allPageVersions, taskId],
  );
  const finalComposition = useMemo(
    () => allFinalCompositions.find((item) => item.taskId === taskId),
    [allFinalCompositions, taskId],
  );
  const finalCompositionPages = useMemo(
    () => {
      const taskPages = allFinalCompositionPages.filter((page) => page.taskId === taskId);
      return getOrderedCompositionPages(finalComposition, taskPages);
    },
    [allFinalCompositionPages, finalComposition, taskId],
  );

  if (!taskId || !task) {
    return <Navigate to="/" replace />;
  }

  return (
    <WorkspaceShell
      task={task}
      pages={pages}
      packagingPages={packagingPages}
      pageVersions={pageVersions}
      finalComposition={finalComposition}
      finalCompositionPages={finalCompositionPages}
    />
  );
}
