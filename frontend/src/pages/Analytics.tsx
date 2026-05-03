import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  CalendarClock,
  Check,
  CheckCircle2,
  CheckSquare,
  ClipboardList,
  Clock,
  FileText,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Pencil,
  Plus,
  Tag,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Task, getTasks, setAuthToken } from "../services/api";
import { useNavigate } from "react-router-dom";

const darkPanel =
  "rounded-2xl border border-slate-800/90 bg-slate-950/70 shadow-2xl shadow-black/30 backdrop-blur-xl";

export default function Analytics() {
  const navigate = useNavigate();
  const darkPanel =
    "rounded-2xl border border-slate-800/90 bg-slate-950/70 shadow-2xl shadow-black/30 backdrop-blur-xl";

  const navItems: Array<{ label: string; Icon: LucideIcon }> = [
    { label: "Dashboard", Icon: LayoutDashboard },
    { label: "My Tasks", Icon: ListTodo },
    { label: "Analytics", Icon: BarChart3 },
  ];

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setAuthToken(null);
    navigate("/");
  }, [navigate]);

  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    let mounted = true;
    getTasks()
      .then((res) => {
        if (mounted) setTasks(res.data);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    // Ensure the page starts at the top when this route mounts
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);

  const analyticsDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      const key = date.toISOString().slice(0, 10);
      const completed = tasks.filter((task) => task.completed_at?.startsWith(key)).length;
      const scheduled = tasks.filter((task) => (task as any).start_datetime?.startsWith(key)).length;
      return {
        key,
        label: date.toLocaleDateString(undefined, { weekday: "short" }),
        completed,
        scheduled,
        score: scheduled > 0 ? Math.round((completed / scheduled) * 100) : 0,
      };
    });
  }, [tasks]);

  const maxCompleted = Math.max(1, ...analyticsDays.map((day) => day.completed));
  const completedTasks = tasks.filter((t) => t.completed).length;
  const completionRate = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#1e1b4b_0,#0f172a_35%,#020617_72%)] p-4 text-white sm:p-6">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-7xl flex-col gap-4 lg:min-h-[calc(100vh-3rem)] lg:flex-row">
        <aside className={`${darkPanel} flex flex-col justify-between p-4 lg:w-64 lg:p-6 lg:sticky lg:top-6 lg:self-start`}>
          <div>
            <div className="mb-6 flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-purple-600 shadow-lg shadow-purple-950/50">
                <CheckSquare className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <p className="text-lg font-bold">TaskFlow</p>
                <p className="text-xs text-slate-400">Workspace</p>
              </div>
            </div>

            <nav className="grid gap-2 text-sm font-medium">
              {navItems.map(({ label, Icon }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    if (label === "My Tasks") {
                      navigate("/dashboard");
                    } else if (label === "Analytics") {
                      navigate("/analytics");
                    } else {
                      navigate("/dashboard");
                    }
                  }}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left transition duration-300 hover:bg-white/10 ${
                    label === "Dashboard"
                      ? "bg-purple-500/20 font-semibold text-white shadow-lg shadow-purple-950/30 ring-1 ring-purple-400/20"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {label}
                </button>
              ))}
            </nav>
          </div>

          <button
            onClick={logout}
            className="mt-6 flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-left text-sm font-semibold text-red-300 transition duration-300 hover:bg-red-500/20 hover:text-red-100 hover:shadow-2xl"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Logout
          </button>
        </aside>

        <main className="flex-1 space-y-4">
          <header className={`${darkPanel} p-6`}>
            <h1 className="flex items-center gap-3 text-2xl font-bold">
              <BarChart3 className="h-6 w-6" /> Analytics Dashboard
            </h1>
            <p className="mt-2 text-sm text-slate-400">Completion history and productivity trends from the last 7 days.</p>
          </header>

          <section className={`${darkPanel} mt-4 p-4`}>
            <div className="mb-5 flex items-center justify-between">
              <div className="text-sm text-slate-300 flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2">
                <TrendingUp className="h-4 w-4 text-green-300" />
                {completionRate}% overall completion
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <div className="flex h-56 items-end gap-3">
                  {analyticsDays.map((day) => (
                    <div key={day.key} className="flex flex-1 flex-col items-center gap-2">
                      <div className="flex h-40 w-full items-end rounded-xl bg-slate-900/80 p-1">
                        <div
                          className="w-full rounded-lg bg-gradient-to-t from-purple-600 to-blue-400 shadow-lg shadow-purple-950/40 transition-all"
                          style={{
                            height: `${Math.max(8, (day.completed / maxCompleted) * 100)}%`,
                          }}
                        />
                      </div>
                      <p className="text-xs font-semibold text-slate-400">{day.label}</p>
                      <p className="text-xs text-slate-500">{day.completed} done</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-3">
                {analyticsDays.map((day) => (
                  <div key={day.key} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="font-semibold text-slate-200">{day.label}</span>
                      <span className="text-slate-400">{day.score}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-purple-500"
                        style={{ width: `${Math.min(day.score, 100)}%` }}
                        aria-valuenow={day.score}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      />
                    </div>
                    <p className="mt-2 text-xs text-slate-500">{day.completed} completed · {day.scheduled} scheduled</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
