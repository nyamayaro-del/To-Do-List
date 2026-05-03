import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  
  X,
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

type FilterKey = "pending" | "due" | "upcoming" | "overdue" | "completed";

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  tone: "warning" | "danger";
};

const categoryOptions = [
  "education",
  "exercise",
  "food",
  "personal",
  "work",
  "health",
  "finance",
  "other",
];

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

const parseTaskDate = (value: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toLocalInputValue = (value: string | null) => {
  const date = parseTaskDate(value);
  if (!date) return "";

  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 16);
};

const formatDateTime = (value: string | null) => {
  const date = parseTaskDate(value);
  if (!date) return "No schedule";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const getTaskStatus = (task: Task, now: Date): FilterKey => {
  if (task.completed) return "completed";

  const scheduledAt = parseTaskDate((task as any).start_datetime || (task as any).scheduled_at);
  if (!scheduledAt) return "pending";

  const diff = scheduledAt.getTime() - now.getTime();
  if (diff < 0) return "overdue";
  if (diff <= 24 * 60 * 60 * 1000) return "due";
  return "upcoming";
};

export default function Dashboard() {
  const [message, setMessage] = useState("Loading...");
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("education");
  const [startDatetime, setStartDatetime] = useState("");
  const [endDatetime, setEndDatetime] = useState("");
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingDescription, setEditingDescription] = useState("");
  const [editingCategory, setEditingCategory] = useState("other");
  const [editingStartDatetime, setEditingStartDatetime] = useState("");
  const [editingEndDatetime, setEditingEndDatetime] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("pending");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [error, setError] = useState("");
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const notifiedTasks = useRef<Set<string>>(new Set());

  const navigate = useNavigate();
  const dashboardRef = useRef<HTMLElement | null>(null);
  const tasksRef = useRef<HTMLElement | null>(null);
  const analyticsRef = useRef<HTMLElement | null>(null);
  const darkPanel =
    "rounded-2xl border border-slate-800/90 bg-slate-950/70 shadow-2xl shadow-black/30 backdrop-blur-xl";
  const now = useMemo(() => new Date(currentTime), [currentTime]);
  const completedTasks = tasks.filter((task) => task.completed).length;
  const pendingTasks = tasks.filter((task) => !task.completed).length;
  const overdueTasks = tasks.filter((task) => getTaskStatus(task, now) === "overdue").length;
  const dueTasks = tasks.filter((task) => getTaskStatus(task, now) === "due").length;
  const userName = currentUser?.username || "there";

  const navItems: Array<{ label: string; Icon: LucideIcon }> = [
    { label: "Dashboard", Icon: LayoutDashboard },
    { label: "My Tasks", Icon: ListTodo },
    { label: "Analytics", Icon: BarChart3 },
  ];

  const stats: Array<{
    label: string;
    value: number;
    Icon: LucideIcon;
    tone: string;
  }> = [
    {
      label: "Total Tasks",
      value: tasks.length,
      Icon: ClipboardList,
      tone: "bg-blue-500/15 text-blue-300 shadow-blue-950/40",
    },
    {
      label: "Completed",
      value: completedTasks,
      Icon: CheckCircle2,
      tone: "bg-green-500/15 text-green-300 shadow-green-950/40",
    },
    {
      label: "Due Soon",
      value: dueTasks,
      Icon: CalendarClock,
      tone: "bg-purple-500/15 text-purple-300 shadow-purple-950/40",
    },
    {
      label: "Overdue",
      value: overdueTasks,
      Icon: AlertTriangle,
      tone: "bg-red-500/15 text-red-300 shadow-red-950/40",
    },
  ];

  const filterOptions: Array<{ key: FilterKey; label: string; count: number }> = [
    { key: "pending", label: "Pending", count: pendingTasks },
    { key: "due", label: "Due", count: dueTasks },
    {
      key: "upcoming",
      label: "Upcoming",
      count: tasks.filter((task) => getTaskStatus(task, now) === "upcoming").length,
    },
    { key: "overdue", label: "Missed/Overdue", count: overdueTasks },
    { key: "completed", label: "Completed", count: completedTasks },
  ];

  const filteredTasks = useMemo(
    () =>
      tasks
        .filter((task) => {
          if (filter === "pending") return !task.completed;
          return getTaskStatus(task, now) === filter;
        })
          .sort((a, b) => {
          const aDate = parseTaskDate((a as any).start_datetime || (a as any).scheduled_at)?.getTime() ?? Number.MAX_SAFE_INTEGER;
          const bDate = parseTaskDate((b as any).start_datetime || (b as any).scheduled_at)?.getTime() ?? Number.MAX_SAFE_INTEGER;
          return aDate - bDate;
        }),
    [filter, now, tasks]
  );

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
  const completionRate =
    tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

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

  const pushNotification = useCallback((notification: NotificationItem) => {
    setNotifications((existing) => [notification, ...existing].slice(0, 4));

    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(notification.title, { body: notification.body });
    }
  }, []);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => setCurrentTime(Date.now()), 60000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const checkNotifications = () => {
      const currentTime = Date.now();

      tasks.forEach((task) => {
        if (task.completed) return;

        const scheduled = parseTaskDate((task as any).start_datetime || (task as any).scheduled_at);
        if (!scheduled) return;

        const diff = scheduled.getTime() - currentTime;
        const startingKey = `starting-${task.id}`;
        const overdueKey = `overdue-${task.id}`;

        if (diff > 0 && diff <= 5 * 60 * 1000 && !notifiedTasks.current.has(startingKey)) {
          notifiedTasks.current.add(startingKey);
          pushNotification({
            id: startingKey,
            title: "Task starting soon",
            body: `${task.title} is scheduled for ${formatDateTime((task as any).start_datetime || (task as any).scheduled_at)}.`,
            tone: "warning",
          });
        }

        if (diff < 0 && !notifiedTasks.current.has(overdueKey)) {
          notifiedTasks.current.add(overdueKey);
          pushNotification({
            id: overdueKey,
            title: "Task missed",
            body: `${task.title} is overdue.`,
            tone: "danger",
          });
        }
      });
    };

    checkNotifications();
    const intervalId = window.setInterval(checkNotifications, 30000);
    return () => window.clearInterval(intervalId);
  }, [pushNotification, tasks]);

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

  const resetTaskForm = () => {
    setTitle("");
    setDescription("");
    setCategory("education");
    setStartDatetime("");
    setEndDatetime("");
  };

  const handleAddTask = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !startDatetime || !endDatetime) {
      setError("Task title, start and end date/time are required");
      return;
    }

    setError("");

    try {
      const res = await createTask({
        title: title.trim(),
        description: description.trim(),
        category,
        start_datetime: startDatetime,
        end_datetime: endDatetime,
      });
      setTasks((existing) => [res.data, ...existing]);
      resetTaskForm();
      setShowAddForm(false);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Could not create task"));
    }
  };

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

  const startEditing = (task: Task) => {
    setEditingTaskId(task.id);
    setEditingTitle(task.title);
    setEditingDescription(task.description);
    setEditingCategory(task.category || "other");
    setEditingStartDatetime(toLocalInputValue((task as any).start_datetime || (task as any).scheduled_at));
    setEditingEndDatetime(toLocalInputValue((task as any).end_datetime || (task as any).scheduled_at));
    setError("");
  };

  const cancelEditing = () => {
    setEditingTaskId(null);
    setEditingTitle("");
    setEditingDescription("");
    setEditingCategory("other");
    setEditingStartDatetime("");
    setEditingEndDatetime("");
    setError("");
  };

  const saveEditing = async (task: Task) => {
    const nextTitle = editingTitle.trim();

    if (!nextTitle || !editingStartDatetime || !editingEndDatetime) {
      setError("Task title and start/end date/time are required");
      return;
    }

    const editStart = parseTaskDate(editingStartDatetime);
    const editEnd = parseTaskDate(editingEndDatetime);
    if (!editStart || !editEnd || editEnd.getTime() <= editStart.getTime()) {
      setError("End date/time must be after start date/time");
      return;
    }

    setError("");

    try {
      const res = await updateTask(task.id, {
        title: nextTitle,
        description: editingDescription.trim(),
        category: editingCategory,
        start_datetime: editingStartDatetime,
        end_datetime: editingEndDatetime,
      });
      setTasks((existing) =>
        existing.map((item) => (item.id === task.id ? res.data : item))
      );
      cancelEditing();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Could not save task"));
    }
  };

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
                      tasksRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                    } else if (label === "Analytics") {
                      navigate("/analytics");
                    } else {
                      dashboardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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
          <header ref={dashboardRef} className={`${darkPanel} flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6`}>
            <div>
              <p className="mb-2 text-sm font-medium text-slate-400">{message}</p>
              <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Dashboard</h1>
              <p className="mt-1 text-sm text-slate-400">
                Schedule, track, and complete your work, {userName}.
              </p>
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

          {notifications.length > 0 && (
            <section className="grid gap-3">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`flex items-start justify-between gap-3 rounded-2xl border p-4 shadow-xl ${
                    notification.tone === "danger"
                      ? "border-red-500/40 bg-red-500/10 text-red-100"
                      : "border-amber-500/40 bg-amber-500/10 text-amber-100"
                  }`}
                >
                  <div className="flex gap-3">
                    <Bell className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                    <div>
                      <p className="font-semibold">{notification.title}</p>
                      <p className="mt-1 text-sm opacity-80">{notification.body}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setNotifications((items) =>
                        items.filter((item) => item.id !== notification.id)
                      )
                    }
                    className="rounded-lg p-1 transition hover:bg-white/10"
                    aria-label="Dismiss notification"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              ))}
            </section>
          )}

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {stats.map(({ label, value, Icon, tone }) => (
              <div
                key={label}
                className={`${darkPanel} flex items-center gap-4 p-5 transition duration-300 hover:scale-[1.01] hover:shadow-2xl`}
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

          <section ref={analyticsRef} className={`${darkPanel} p-4 sm:p-6`}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Add Task</h2>
              <button
                type="button"
                onClick={() => setShowAddForm((s) => !s)}
                className="flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-purple-950/40 transition duration-300 hover:bg-purple-500"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add Task
              </button>
            </div>

            {showAddForm && (
              <form onSubmit={handleAddTask} className="grid gap-4">
                <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
                  <label>
                    <span className="mb-2 block text-sm font-semibold text-slate-200">Title</span>
                    <input
                      className="min-h-12 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-white outline-none placeholder:text-slate-500 transition duration-300 focus:border-purple-400 focus:bg-slate-900 focus:ring-2 focus:ring-purple-500/40"
                      placeholder="What do you need to do?"
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                    />
                  </label>

                  <label>
                    <span className="mb-2 block text-sm font-semibold text-slate-200">Start (date & time)</span>
                    <input
                      type="datetime-local"
                      className="min-h-12 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-white outline-none transition duration-300 focus:border-purple-400 focus:bg-slate-900 focus:ring-2 focus:ring-purple-500/40"
                      value={startDatetime}
                      onChange={(event) => setStartDatetime(event.target.value)}
                    />
                  </label>
                </div>

                <div className="grid gap-4 lg:grid-cols-[1fr_1fr_220px]">
                  <label>
                    <span className="mb-2 block text-sm font-semibold text-slate-200">End (date & time)</span>
                    <input
                      type="datetime-local"
                      className="min-h-12 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-white outline-none transition duration-300 focus:border-purple-400 focus:bg-slate-900 focus:ring-2 focus:ring-purple-500/40"
                      value={endDatetime}
                      onChange={(event) => setEndDatetime(event.target.value)}
                    />
                  </label>

                  <label>
                    <span className="mb-2 block text-sm font-semibold text-slate-200">Description</span>
                    <input
                      className="min-h-12 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-white outline-none placeholder:text-slate-500 transition duration-300 focus:border-purple-400 focus:bg-slate-900 focus:ring-2 focus:ring-purple-500/40"
                      placeholder="Add more detail..."
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                    />
                  </label>

                  <div className="flex flex-col justify-end">
                    <label>
                      <span className="mb-2 block text-sm font-semibold text-slate-200">Category</span>
                      <select
                        className="min-h-12 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-white outline-none transition duration-300 focus:border-purple-400 focus:bg-slate-900 focus:ring-2 focus:ring-purple-500/40"
                        value={category}
                        onChange={(event) => setCategory(event.target.value)}
                      >
                        {categoryOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="mt-3 flex gap-2">
                      <button
                        type="submit"
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-purple-950/50 transition duration-300 hover:bg-purple-500"
                      >
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        Create
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          resetTaskForm();
                          setShowAddForm(false);
                          setError("");
                        }}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-300 transition duration-300 hover:bg-slate-800"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            )}

            {error && (
              <p className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p>
            )}
          </section>

          <section ref={tasksRef} className={`${darkPanel} p-4 shadow-xl transition duration-300 hover:shadow-2xl sm:p-6`}>
            <div className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <ListTodo className="h-5 w-5" aria-hidden="true" />
                My Tasks
              </h2>
              <div className="flex flex-wrap gap-2">
                {filterOptions.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setFilter(option.key)}
                    className={`rounded-xl px-3 py-2 text-sm font-semibold transition duration-300 ${
                      filter === option.key
                        ? "bg-purple-600 text-white shadow-lg shadow-purple-950/40"
                        : "border border-slate-700 bg-slate-950/60 text-slate-400 hover:bg-slate-900 hover:text-white"
                    }`}
                  >
                    {option.label} · {option.count}
                  </button>
                ))}
              </div>
            </div>

            {loadingTasks ? (
              <p className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-slate-400">
                Loading tasks...
              </p>
            ) : filteredTasks.length === 0 ? (
              <p className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-slate-400">
                No tasks in this view
              </p>
            ) : (
              <div className="space-y-3">
                {filteredTasks.map((task) => {
                  const isEditing = editingTaskId === task.id;
                  const status = getTaskStatus(task, now);

                  return (
                    <div
                      key={task.id}
                      className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-950/80 p-4 shadow-xl shadow-black/20 transition duration-300 hover:scale-[1.01] hover:border-purple-500/40 hover:bg-slate-900/90 hover:shadow-2xl"
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                          <button
                            type="button"
                            onClick={() => toggleTask(task)}
                            className={`mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-md border transition duration-300 ${
                              task.completed
                                ? "border-green-400 bg-green-500/90 text-white"
                                : "border-slate-600 bg-slate-900 text-transparent hover:border-purple-400 hover:bg-purple-500/10"
                            }`}
                            aria-label="Toggle task completion"
                          >
                            <Check className="h-4 w-4" aria-hidden="true" />
                          </button>

                          {isEditing ? (
                            <div className="grid flex-1 gap-3">
                              <input
                                className="min-h-11 rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-white outline-none placeholder:text-slate-500 focus:border-purple-400 focus:ring-2 focus:ring-purple-500/40"
                                value={editingTitle}
                                onChange={(event) => setEditingTitle(event.target.value)}
                                autoFocus
                              />
                              <input
                                className="min-h-11 rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-white outline-none placeholder:text-slate-500 focus:border-purple-400 focus:ring-2 focus:ring-purple-500/40"
                                value={editingDescription}
                                onChange={(event) => setEditingDescription(event.target.value)}
                                placeholder="Description"
                              />
                              <div className="grid gap-3 sm:grid-cols-2">
                                <input
                                  type="datetime-local"
                                  className="min-h-11 rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-white outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/40"
                                  value={editingStartDatetime}
                                  onChange={(event) => setEditingStartDatetime(event.target.value)}
                                />
                                <input
                                  type="datetime-local"
                                  className="min-h-11 rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-white outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/40"
                                  value={editingEndDatetime}
                                  onChange={(event) => setEditingEndDatetime(event.target.value)}
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="min-w-0 flex-1">
                              <p
                                className={`truncate font-semibold ${
                                  task.completed ? "text-slate-500 line-through" : "text-white"
                                }`}
                              >
                                {task.title}
                              </p>
                              {task.description && (
                                <p className="mt-1 flex items-center gap-2 text-sm text-slate-400">
                                  <FileText className="h-4 w-4" aria-hidden="true" />
                                  {task.description}
                                </p>
                              )}
                              <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                                <span className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-slate-300">
                                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                                  {`${formatDateTime((task as any).start_datetime)} → ${formatDateTime((task as any).end_datetime)}`}
                                </span>
                                <span className="inline-flex items-center gap-1 rounded-lg border border-purple-500/20 bg-purple-500/10 px-2 py-1 text-purple-200">
                                  <Tag className="h-3.5 w-3.5" aria-hidden="true" />
                                  {task.category || "other"}
                                </span>
                                <span
                                  className={`rounded-lg px-2 py-1 ${
                                    status === "completed"
                                      ? "bg-green-500/10 text-green-300"
                                      : status === "overdue"
                                      ? "bg-red-500/10 text-red-300"
                                      : status === "due"
                                      ? "bg-amber-500/10 text-amber-300"
                                      : "bg-blue-500/10 text-blue-300"
                                  }`}
                                >
                                  {status === "overdue" ? "missed/overdue" : status}
                                </span>
                              </div>
                            </div>
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
