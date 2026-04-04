import { NavLink } from "react-router-dom";
import { useAppStore } from "@/store/appStore";

function SidebarSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <p className="px-3 text-xs font-semibold uppercase tracking-[0.24em] text-muted/80">{title}</p>
      {children}
    </section>
  );
}

export function Sidebar() {
  const projects = useAppStore((state) => state.projects);
  const tasks = useAppStore((state) => state.tasks);

  return (
    <aside className="hidden w-[292px] shrink-0 rounded-[28px] border border-white/60 bg-[#f7f9fc] p-4 shadow-panel lg:flex lg:flex-col">
      <div className="rounded-[24px] bg-ink px-4 py-4 text-white">
        <p className="text-xs uppercase tracking-[0.24em] text-white/60">Workspace</p>
        <h1 className="mt-2 text-2xl font-semibold">PagesCut</h1>
        <p className="mt-2 text-sm text-white/70">Page-based generation workspace for monthly magazines, reports and decks.</p>
      </div>

      <div className="mt-6 flex-1 space-y-6 overflow-y-auto">
        <SidebarSection title="New Chat">
          <NavLink
            to="/"
            className={({ isActive }) =>
              `block rounded-2xl border px-4 py-3 text-sm transition ${
                isActive ? "border-ink bg-white text-ink shadow-sm" : "border-transparent bg-white/70 text-muted hover:border-line"
              }`
            }
          >
            开始新的任务会话吧
          </NavLink>
        </SidebarSection>

        <SidebarSection title="Assets">
          <NavLink
            to="/assets"
            className={({ isActive }) =>
              `block rounded-2xl px-4 py-3 text-sm transition ${
                isActive ? "bg-white text-ink shadow-sm" : "bg-white/70 text-muted hover:text-ink"
              }`
            }
          >
            查看最终产物
          </NavLink>
        </SidebarSection>

        <SidebarSection title="Projects">
          <div className="space-y-3">
            {projects.map((project) => (
              <div key={project.id} className="rounded-2xl border border-white/70 bg-white/70 px-4 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-ink">{project.name}</p>
                  {project.isDefault ? (
                    <span className="rounded-full bg-[#edf2f8] px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-muted">Default</span>
                  ) : null}
                </div>
                <div className="mt-3 space-y-2">
                  {tasks
                    .filter((task) => project.taskIds.includes(task.id))
                    .map((task) => (
                      <NavLink
                        key={task.id}
                        to={`/workspace/${task.id}`}
                        className={({ isActive }) =>
                          `block rounded-xl px-3 py-2 text-sm transition ${
                            isActive ? "bg-ink text-white" : "bg-[#f8fafc] text-muted hover:text-ink"
                          }`
                        }
                      >
                        {task.title}
                      </NavLink>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </SidebarSection>
      </div>
    </aside>
  );
}
