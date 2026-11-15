import { useEffect, useState, type FormEvent } from "react";
import { Icon, WaveLogo } from "../components/Icons";
import { Link, useRouter } from "../lib/router";
import { useAuth } from "../lib/auth";
import { useToast } from "../lib/toast";
import { api } from "../lib/api";

const ERRORS: Record<string, string> = {
  cancelled: "Sign-in was cancelled. Try again whenever you're ready.",
  expired: "That sign-in took too long or was opened in another browser. Please try again.",
  google: "Google couldn't confirm your sign-in. Please try again.",
  unverified: "Your Google account's email isn't verified yet. Verify it with Google, then try again.",
  not_configured: "Google sign-in isn't set up on this site yet (README: Google sign-in).",
};

export function Login() {
  const { user, signIn } = useAuth();
  const { navigate } = useRouter();
  const [busy, setBusy] = useState(false);
  const params = new URLSearchParams(window.location.search);
  const error = params.get("error");
  const isSignup = params.get("mode") === "signup";

  useEffect(() => {
    if (user) navigate("/", { replace: true });
  }, [user, navigate]);

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-10">
      <div className="card p-6 sm:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <WaveLogo className="h-10 w-10 text-primary" />
          <h1 className="mt-2 text-2xl font-bold">{isSignup ? "Join EchoWave" : "Welcome back"}</h1>
          <p className="mt-1 text-sm text-muted">Share and discover what's happening near you.</p>
        </div>

        {error && (
          <p className="mb-4 rounded-lg bg-danger/10 p-3 text-sm text-danger" role="alert">
            {ERRORS[error] ?? "Something went wrong. Please try again."}
          </p>
        )}

        <button
          className="btn-secondary w-full py-3 text-base"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            signIn("/");
          }}
        >
          {busy ? <Icon name="loader" className="h-5 w-5" /> : <Icon name="google" className="h-5 w-5" />}
          Continue with Google
        </button>

        <p className="mt-5 text-center text-xs leading-relaxed text-muted">
          By continuing you confirm you're at least 13 and agree to the{" "}
          <Link to="/terms" className="text-primary underline">Terms</Link>,{" "}
          <Link to="/guidelines" className="text-primary underline">Community Guidelines</Link> and{" "}
          <Link to="/privacy" className="text-primary underline">Privacy Policy</Link>. No tolerance for abusive content.
        </p>
        <p className="mt-3 text-center text-xs text-muted">
          We only receive your name and email from Google. We never see your Google password.
        </p>
      </div>
    </div>
  );
}

/** Shown once after first sign-in so every user has a public username. */
export function ChooseUsername() {
  const { user, refresh, signOut } = useAuth();
  const [name, setName] = useState(() =>
    (user?.name ?? user?.email?.split("@")[0] ?? "").replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/me", { method: "POST", body: JSON.stringify({ username: name }) });
      await refresh();
      toast("success", `Welcome to EchoWave, ${name}!`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <form onSubmit={save} className="card space-y-4 p-6 sm:p-8">
        <div className="text-center">
          <WaveLogo className="mx-auto h-10 w-10 text-primary" />
          <h1 className="mt-2 text-2xl font-bold">Pick a username</h1>
          <p className="mt-1 text-sm text-muted">This is how others see you. Your email stays private.</p>
        </div>
        <div>
          <label htmlFor="uname" className="label">Username</label>
          <input id="uname" className="field" value={name} onChange={(e) => setName(e.target.value)} pattern="[A-Za-z0-9_]{3,20}" required maxLength={20} />
          <p className="mt-1 text-xs text-muted">3–20 characters: letters, numbers and _</p>
        </div>
        {error && <p className="text-sm text-danger" role="alert">{error}</p>}
        <button className="btn-primary w-full py-2.5" disabled={busy}>{busy && <Icon name="loader" />} Continue</button>
        <button type="button" className="btn-ghost w-full" onClick={signOut}>Sign out</button>
      </form>
    </div>
  );
}
