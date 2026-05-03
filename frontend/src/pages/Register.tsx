import { FormEvent, useState } from "react";
import { Eye, EyeOff, Lock, Mail, Plus, ShieldCheck, User } from "lucide-react";
import { loginUser, registerUser, setAuthToken } from "../services/api";
import { useNavigate } from "react-router-dom";

export default function Register() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const darkPanel =
    "rounded-2xl border border-slate-800/90 bg-slate-950/70 shadow-2xl shadow-black/30 backdrop-blur-xl";

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

  const handleRegister = async (event: FormEvent) => {
    event.preventDefault();

    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedUsername || !trimmedEmail || !password || !confirmPassword) {
      setError("All fields are required");
      return;
    }

    if (!emailPattern.test(trimmedEmail)) {
      setError("Enter a valid email address");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await registerUser({
        username: trimmedUsername,
        email: trimmedEmail,
        password,
      });

      const loginResponse = await loginUser({
        username: trimmedUsername,
        password,
      });

      localStorage.setItem("token", loginResponse.data.token);
      localStorage.setItem("user", JSON.stringify(loginResponse.data.user));
      setAuthToken(loginResponse.data.token);
      navigate("/dashboard");
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Registration failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#1e1b4b_0,#0f172a_35%,#020617_72%)] px-4 py-8 text-white">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="hidden lg:block">
          <div className="mb-10 grid h-16 w-16 place-items-center rounded-full bg-purple-600 shadow-lg shadow-purple-950/50">
            <Plus className="h-8 w-8" aria-hidden="true" />
          </div>

          <h1 className="max-w-md text-4xl font-bold leading-tight">
            Create your sleek TaskFlow workspace
          </h1>
          <p className="mt-4 max-w-sm text-slate-400">
            Start organizing work in a focused dark dashboard built for clarity,
            momentum, and calm daily execution.
          </p>

          <div className="mt-8 grid max-w-sm gap-3">
            {["Easy to use", "Track everything", "Achieve more"].map((item) => (
              <div key={item} className={`${darkPanel} flex items-center gap-3 p-4`}>
                <ShieldCheck className="h-5 w-5 text-purple-300" aria-hidden="true" />
                <p className="font-semibold">{item}</p>
              </div>
            ))}
          </div>
        </section>

        <form
          onSubmit={handleRegister}
          className={`${darkPanel} mx-auto w-full max-w-md p-6 transition duration-300 hover:scale-[1.01] hover:shadow-2xl sm:p-8`}
        >
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-bold">Create Account</h2>
            <p className="mt-2 text-sm text-slate-400">Let's get you started.</p>
          </div>

          <label className="mb-4 block">
            <span className="mb-2 block text-sm font-semibold text-slate-200">
              Username
            </span>
            <div className="flex min-h-12 items-center rounded-xl border border-slate-700 bg-slate-950/80 transition duration-300 focus-within:border-purple-400 focus-within:bg-slate-900 focus-within:ring-2 focus-within:ring-purple-500/40">
              <User className="ml-4 h-4 w-4 text-slate-500" aria-hidden="true" />
              <input
                className="min-w-0 flex-1 bg-transparent px-3 py-3 text-white outline-none placeholder:text-slate-500"
                placeholder="Choose a username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          </label>

          <label className="mb-4 block">
            <span className="mb-2 block text-sm font-semibold text-slate-200">
              Email
            </span>
            <div className="flex min-h-12 items-center rounded-xl border border-slate-700 bg-slate-950/80 transition duration-300 focus-within:border-purple-400 focus-within:bg-slate-900 focus-within:ring-2 focus-within:ring-purple-500/40">
              <Mail className="ml-4 h-4 w-4 text-slate-500" aria-hidden="true" />
              <input
                type="email"
                className="min-w-0 flex-1 bg-transparent px-3 py-3 text-white outline-none placeholder:text-slate-500"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </label>

          <label className="mb-4 block">
            <span className="mb-2 block text-sm font-semibold text-slate-200">
              Password
            </span>
            <PasswordField
              value={password}
              placeholder="Create a password"
              showPassword={showPassword}
              onChange={setPassword}
              onToggle={() => setShowPassword((visible) => !visible)}
            />
          </label>

          <label className="mb-4 block">
            <span className="mb-2 block text-sm font-semibold text-slate-200">
              Confirm Password
            </span>
            <PasswordField
              value={confirmPassword}
              placeholder="Confirm your password"
              showPassword={showPassword}
              onChange={setConfirmPassword}
              onToggle={() => setShowPassword((visible) => !visible)}
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 min-h-12 w-full rounded-xl bg-purple-600 px-4 font-semibold text-white shadow-lg shadow-purple-950/50 transition duration-300 hover:scale-[1.01] hover:bg-purple-500 hover:shadow-2xl disabled:cursor-not-allowed disabled:bg-purple-300"
          >
            {loading ? "Creating..." : "Create Account"}
          </button>

          {error && (
            <p className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </p>
          )}

          <p className="mt-6 text-center text-sm text-slate-400">
            Already have an account?{" "}
            <button
              type="button"
              className="font-semibold text-purple-300 transition duration-300 hover:text-purple-200"
              onClick={() => navigate("/")}
            >
              Login
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}

type PasswordFieldProps = {
  value: string;
  placeholder: string;
  showPassword: boolean;
  onChange: (value: string) => void;
  onToggle: () => void;
};

function PasswordField({
  value,
  placeholder,
  showPassword,
  onChange,
  onToggle,
}: PasswordFieldProps) {
  return (
    <div className="flex min-h-12 items-center rounded-xl border border-slate-700 bg-slate-950/80 transition duration-300 focus-within:border-purple-400 focus-within:bg-slate-900 focus-within:ring-2 focus-within:ring-purple-500/40">
      <Lock className="ml-4 h-4 w-4 text-slate-500" aria-hidden="true" />
      <input
        type={showPassword ? "text" : "password"}
        className="min-w-0 flex-1 bg-transparent px-3 py-3 text-white outline-none placeholder:text-slate-500"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />

      <button
        type="button"
        onClick={onToggle}
        className="rounded-r-xl px-4 text-slate-400 transition duration-300 hover:bg-white/10 hover:text-white"
        aria-label={showPassword ? "Hide password" : "Show password"}
      >
        {showPassword ? (
          <EyeOff className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Eye className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

export {};
