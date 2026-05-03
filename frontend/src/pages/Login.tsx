import { FormEvent, useState } from "react";
import { loginUser, setAuthToken } from "../services/api";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const glassPanel =
    "rounded-2xl border border-white/20 bg-white/10 shadow-xl backdrop-blur-lg";

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

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();

    if (!username || !password) {
      setError("All fields are required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await loginUser({ username, password });

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));
      setAuthToken(res.data.token);

      navigate("/dashboard");
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Invalid credentials"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-blue-500 px-4 py-8 text-white">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="hidden lg:block">
          <div className="mb-10 flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-indigo-500 shadow-lg shadow-indigo-950/30">
              <span className="text-2xl font-bold">✓</span>
            </div>
            <div>
              <p className="text-2xl font-bold">TaskFlow</p>
              <p className="text-sm text-white/60">Productive work, organized.</p>
            </div>
          </div>

          <h1 className="max-w-md text-4xl font-bold leading-tight">Welcome back to your productivity dashboard</h1>
          <p className="mt-4 max-w-sm text-white/75">Sign in to manage tasks, track progress, and keep today moving with a cleaner workflow.</p>

          <div className="mt-8 grid max-w-sm gap-3">
            {["Stay organized", "Track progress", "Work securely"].map((item) => (
              <div key={item} className={`${glassPanel} p-4`}>
                <p className="font-semibold">{item}</p>
              </div>
            ))}
          </div>
        </section>

        <form
          onSubmit={handleLogin}
          className={`${glassPanel} mx-auto w-full max-w-md p-6 transition duration-300 hover:scale-[1.01] hover:shadow-2xl sm:p-8`}
        >
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-bold">Login</h2>
            <p className="mt-2 text-sm text-white/70">Welcome back. Please login to your account.</p>
          </div>

          <label className="mb-4 block">
            <span className="mb-2 block text-sm font-semibold text-white/85">Email or Username</span>
            <input
              className="min-h-12 w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/55 transition duration-300 focus:border-white/40 focus:bg-white/15 focus:ring-2 focus:ring-white/20"
              placeholder="Enter email or username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </label>

          <label className="mb-4 block">
            <span className="mb-2 block text-sm font-semibold text-white/85">Password</span>
            <div className="flex min-h-12 rounded-xl border border-white/20 bg-white/10 transition duration-300 focus-within:border-white/40 focus-within:bg-white/15 focus-within:ring-2 focus-within:ring-white/20">
              <input
                type={showPassword ? "text" : "password"}
                className="min-w-0 flex-1 rounded-l-xl bg-transparent px-4 py-3 text-white outline-none placeholder:text-white/55"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                className="rounded-r-xl px-4 text-sm font-semibold text-white/75 transition duration-300 hover:bg-white/10 hover:text-white"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 min-h-12 w-full rounded-xl bg-indigo-500 px-4 font-semibold text-white shadow-lg shadow-indigo-950/30 transition duration-300 hover:scale-[1.01] hover:bg-indigo-600 hover:shadow-2xl disabled:cursor-not-allowed disabled:bg-indigo-300"
          >
            {loading ? "Logging in..." : "Login"}
          </button>

          {error && (
            <p className="mt-4 rounded-xl border border-red-300/40 bg-red-500/15 px-4 py-3 text-sm text-red-100">
              {error}
            </p>
          )}

          <p className="mt-6 text-center text-sm text-white/70">
            Don't have an account?{" "}
            <button
              type="button"
              className="font-semibold text-white transition duration-300 hover:text-indigo-100"
              onClick={() => navigate("/register")}
            >
              Register
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}

export {};
