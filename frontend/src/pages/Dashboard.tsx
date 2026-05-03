import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  Check,
  CheckCircle2,
  CheckSquare,
  Circle,
  ClipboardList,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  AuthUser,
  Task,
  createTask,
  deleteTask,
  getProtected,
  getTasks,
  setAuthToken,
  updateTask,
} from "../services/api";
import { useNavigate } from "react-router-dom";

const getErrorMessage = (err: unknown, fallback: string) => {
  if (
    typeof err === "object" &&
    err !== null &&
    "response" in err &&
    typeof err.response === "object" &&
    err.response !== null &&
    "data" in err.response &&
    typeof err.response.data === "object" &&
    err.response.data !== null &&
    "message" in err.response.data &&
    typeof err.response.data.message === "string"
  ) {
    return err.response.data.message;
  }

  return fallback;
};

const isUnauthorizedError = (err: unknown) =>
  typeof err === "object" &&
  err !== null &&
  "response" in err &&
  typeof err.response === "object" &&
  err.response !== null &&
  "status" in err.response &&
  err.response.status === 401;

export default function Dashboard() {
  const [message, setMessage] = useState("Loading...");
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState("");
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [error, setError] = useState("");
  const [loadingTasks, setLoadingTasks] = useState(true);

  const navigate = useNavigate();
  const glassPanel =
    "rounded-2xl border border-slate-800/90 bg-slate-950/70 shadow-2xl shadow-black/30 backdrop-blur-xl";
  const completedTasks = tasks.filter((task) => task.completed).length;
  const pendingTasks = tasks.length - completedTasks;
  const userName = currentUser?.username || "there";
  const navItems: Array<{ label: string; Icon: LucideIcon }> = [
    { label: "Dashboard", Icon: LayoutDashboard },
    { label: "My Tasks", Icon: ListTodo },
    { label: "Completed", Icon: CheckCircle2 },
  ];
  const stats: Array<{
    label: string;
    value: number;
    Icon: LucideIcon;
    tone: string;
  }> = [
    { label: "Total Tasks", value: tasks.length, Icon: ClipboardList, tone: "bg-blue-500/15 text-blue-300 shadow-blue-950/40" },
    { label: "Completed", value: completedTasks, Icon: CheckCircle2, tone: "bg-green-500/15 text-green-300 shadow-green-950/40" },
    { label: "Pending", value: pendingTasks, Icon: Circle, tone: "bg-purple-500/15 text-purple-300 shadow-purple-950/40" },
  ];

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setAuthToken(null);
    navigate("/");
  }, [navigate]);

  const loadTasks = useCallback(async () => {
    setLoadingTasks(true);
    try {
      const res = await getTasks();
      setTasks(res.data);
    } catch (err: unknown) {
      if (isUnauthorizedError(err)) {
        logout();
        return;
      }
      setError(getErrorMessage(err, "Could not load tasks"));
    } finally {
      setLoadingTasks(false);
    }
  }, [logout]);

  // ---------------- AUTH CHECK ----------------
  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      navigate("/");
      return;
    }

    setAuthToken(token);

    const bootstrap = async () => {
      try {
        const res = await getProtected();
        setMessage(res.data.message);
        setCurrentUser(res.data.user);
        localStorage.setItem("user", JSON.stringify(res.data.user));
        await loadTasks();
      } catch {
        logout();
      }
    };

    bootstrap();
  }, [loadTasks, logout, navigate]);

  // ---------------- ADD TASK ----------------
  const handleAddTask = async (event: FormEvent) => {
    event.preventDefault();
    if (!newTask.trim()) return;

    setError("");

    try {
      const res = await createTask({ title: newTask });
      setTasks((existing) => [res.data, ...existing]);
      setNewTask("");
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Could not create task"));
    }
  };

  // ---------------- TOGGLE COMPLETE ----------------
  const toggleTask = async (task: Task) => {
    setError("");

    try {
      const res = await updateTask(task.id, {
        completed: !task.completed,
      });
      setTasks((existing) =>
        existing.map((item) => (item.id === task.id ? res.data : item))
      );
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Could not update task"));
    }
  };

  // ---------------- EDIT TASK ----------------
  const startEditing = (task: Task) => {
    setEditingTaskId(task.id);
    setEditingTitle(task.title);
    setError("");
  };

  const cancelEditing = () => {
    setEditingTaskId(null);
    setEditingTitle("");
    setError("");
  };

  const saveEditing = async (task: Task) => {
    const title = editingTitle.trim();

    if (!title) {
      setError("Task title cannot be empty");
      return;
    }

    if (title === task.title) {
      cancelEditing();
      return;
    }

    setError("");

    try {
      const res = await updateTask(task.id, { title });
      setTasks((existing) =>
        existing.map((item) => (item.id === task.id ? res.data : item))
      );
      setEditingTaskId(null);
      setEditingTitle("");
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Could not save task"));
    }
  };

  // ---------------- DELETE TASK ----------------
  const handleDelete = async (id: number) => {
    setError("");

    try {
      await deleteTask(id);
      setTasks((existing) => existing.filter((task) => task.id !== id));
      if (editingTaskId === id) {
        cancelEditing();
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Could not delete task"));
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#1e1b4b_0,#0f172a_35%,#020617_72%)] p-4 text-white sm:p-6">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-7xl flex-col gap-4 lg:min-h-[calc(100vh-3rem)] lg:flex-row">
        <aside className={`${glassPanel} flex flex-col justify-between p-4 lg:w-64 lg:p-6`}>
          <div>
            <div className="mb-6 flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-purple-600 shadow-lg shadow-purple-950/50">
                <CheckSquare className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <p className="text-lg font-bold">TaskFlow</p>
                <p className="text-xs text-white/60">Workspace</p>
              </div>
            </div>

            <nav className="grid gap-2 text-sm font-medium">
              {navItems.map(({ label, Icon }) => (
                <button
                  key={label}
                  type="button"
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
          <header className={`${glassPanel} flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6`}>
            <div>
              <p className="mb-2 text-sm font-medium text-white/70">{message}</p>
              <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Dashboard</h1>
              <p className="mt-1 text-sm text-slate-400">Stay focused and finish strong, {userName}.</p>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-2 text-sm text-slate-300 sm:block">
                {currentUser ? `Signed in as ${currentUser.username}` : "Checking session"}
              </div>
              <button
                onClick={logout}
                className="flex items-center gap-2 rounded-xl bg-red-500/90 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-red-950/40 transition duration-300 hover:bg-red-500 hover:shadow-2xl"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Logout
              </button>
            </div>
          </header>

          <section className="grid gap-4 md:grid-cols-3">
            {stats.map(({ label, value, Icon, tone }) => (
              <div
                key={label}
                className={`${glassPanel} flex items-center gap-4 p-5 transition duration-300 hover:scale-[1.01] hover:shadow-2xl`}
              >
                <div className={`grid h-12 w-12 place-items-center rounded-2xl ${tone} shadow-lg`}>
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm text-slate-400">{label}</p>
                  <p className="text-4xl font-bold text-white">{value}</p>
                </div>
              </div>
            ))}
          </section>

          <section className={`${glassPanel} p-4 sm:p-6`}>
            <form onSubmit={handleAddTask} className="flex flex-col gap-3 sm:flex-row">
              <input
                className="min-h-12 flex-1 rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-white outline-none placeholder:text-slate-500 transition duration-300 focus:border-purple-400 focus:bg-slate-900 focus:ring-2 focus:ring-purple-500/40"
                placeholder="What do you need to do?"
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
              />

              <button
                type="submit"
                className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-purple-600 px-6 font-semibold text-white shadow-lg shadow-purple-950/50 transition duration-300 hover:scale-[1.01] hover:bg-purple-500 hover:shadow-2xl"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add Task
              </button>
            </form>

            {error && (
              <p className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </p>
            )}
          </section>

          <section className={`${glassPanel} p-4 shadow-xl transition duration-300 hover:shadow-2xl sm:p-6`}>
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <ListTodo className="h-5 w-5" aria-hidden="true" />
                My Tasks
              </h2>
              <p className="text-sm text-slate-400">{tasks.length} tasks</p>
            </div>

            {loadingTasks ? (
              <p className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-slate-400">Loading tasks...</p>
            ) : tasks.length === 0 ? (
              <p className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-slate-400">No tasks yet</p>
            ) : (
              <div className="space-y-3">
                {tasks.map((task) => {
                  const isEditing = editingTaskId === task.id;

                  return (
                    <div
                      key={task.id}
                      className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-950/80 p-4 shadow-xl shadow-black/20 transition duration-300 hover:scale-[1.01] hover:border-purple-500/40 hover:bg-slate-900/90 hover:shadow-2xl sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <button
                          type="button"
                          onClick={() => toggleTask(task)}
                          className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border transition duration-300 ${
                            task.completed
                              ? "border-green-400 bg-green-500/90 text-white"
                              : "border-slate-600 bg-slate-900 text-transparent hover:border-purple-400 hover:bg-purple-500/10"
                          }`}
                        >
                          <Check className="h-4 w-4" aria-hidden="true" />
                        </button>

                        {isEditing ? (
                          <input
                            className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-white outline-none placeholder:text-slate-500 focus:border-purple-400 focus:ring-2 focus:ring-purple-500/40"
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            autoFocus
                          />
                        ) : (
                          <button
                            type="button"
                            className={`min-w-0 flex-1 text-left ${
                              task.completed
                                ? "text-slate-500 line-through"
                                : "text-white"
                            }`}
                            onClick={() => toggleTask(task)}
                          >
                            <span className="block truncate font-semibold">{task.title}</span>
                            <span className="mt-1 block text-xs text-slate-500">
                              {task.completed ? "Completed" : "Pending"}
                            </span>
                          </button>
                        )}
                      </div>

                      <div className="flex shrink-0 gap-2">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              onClick={() => saveEditing(task)}
                              className="flex items-center gap-2 rounded-xl bg-green-500/90 px-4 py-2 text-sm font-semibold text-white transition duration-300 hover:bg-green-500"
                            >
                              <Check className="h-4 w-4" aria-hidden="true" />
                              Save
                            </button>

                            <button
                              type="button"
                              onClick={cancelEditing}
                              className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-300 transition duration-300 hover:bg-slate-800 hover:text-white"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => startEditing(task)}
                              className="flex items-center gap-2 rounded-xl border border-purple-400/20 bg-purple-500/15 px-4 py-2 text-sm font-semibold text-purple-200 transition duration-300 hover:bg-purple-500/25 hover:text-white"
                            >
                              <Pencil className="h-4 w-4" aria-hidden="true" />
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDelete(task.id)}
                              className="flex items-center gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 transition duration-300 hover:bg-red-500/20 hover:text-red-100"
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
