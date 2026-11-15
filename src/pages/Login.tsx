import { useEffect, useState, type FormEvent } from "react";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
} from "firebase/auth";
import { auth, firebaseConfigured } from "../lib/firebase";
import { Icon, WaveLogo } from "../components/Icons";
import { Link, useRouter } from "../lib/router";
import { useAuth } from "../lib/auth";
import { useToast } from "../lib/toast";
import { api } from "../lib/api";

function friendly(code: string): string {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Email or password is incorrect.";
    case "auth/email-already-in-use":
      return "An account with this email already exists. Try logging in.";
    case "auth/weak-password":
      return "Use at least 8 characters for your password.";
    case "auth/invalid-email":
      return "That email address doesn't look right.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a few minutes and try again.";
    case "auth/network-request-failed":
      return "No connection. Check your internet and try again.";
    case "auth/unauthorized-domain":
      return "This website isn't authorised in Firebase yet (see README step 6).";
    default:
      return "Something went wrong. Please try again.";
  }
}

export function Login() {
  const { user } = useAuth();
  const { navigate } = useRouter();
  const toast = useToast();
  const [mode, setMode] = useState<"login" | "signup">(() =>
    new URLSearchParams(window.location.search).get("mode") === "signup" ? "signup" : "login",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) navigate("/", { replace: true });
  }, [user, navigate]);

  const google = async () => {
    if (mode === "signup" && !agree) return setError("Please accept the Terms and Community Guidelines first.");
    setError(null);
    setBusy(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (e) {
      const code = (e as { code?: string }).code ?? "";
      if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
        await signInWithRedirect(auth, provider);
        return;
      }
      if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") setError(friendly(code));
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (mode === "signup") {
      if (!agree) return setError("Please accept the Terms and Community Guidelines first.");
      if (password.length < 8) return setError("Use at least 8 characters for your password.");
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await sendEmailVerification(cred.user).catch(() => {});
        toast("success", "Account created", "Check your inbox for a verification link.");
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (err) {
      setError(friendly((err as { code?: string }).code ?? ""));
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (!email.trim()) return setError("Type your email above first, then tap 'Forgot password'.");
    try {
      await sendPasswordResetEmail(auth, email.trim());
      toast("success", "Password reset email sent", `Check ${email.trim()}.`);
    } catch (err) {
      setError(friendly((err as { code?: string }).code ?? ""));
    }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-10">
      <div className="card p-6 sm:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <WaveLogo className="h-10 w-10 text-primary" />
          <h1 className="mt-2 text-2xl font-bold">{mode === "signup" ? "Join EchoWave" : "Welcome back"}</h1>
          <p className="mt-1 text-sm text-muted">{mode === "signup" ? "Share and discover what's happening near you." : "Log in to broadcast, like and comment."}</p>
        </div>

        {!firebaseConfigured && (
          <p className="mb-4 rounded-lg bg-danger/10 p-3 text-sm text-danger">Firebase isn't configured yet. Fill in the .env file (README step 2).</p>
        )}

        {mode === "signup" && (
          <label className="mb-4 flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5 h-4 w-4" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span>
              I'm at least 13 years old and agree to the <Link to="/terms" className="text-primary underline">Terms</Link>,{" "}
              <Link to="/guidelines" className="text-primary underline">Community Guidelines</Link> and{" "}
              <Link to="/privacy" className="text-primary underline">Privacy Policy</Link>. No tolerance for abusive content.
            </span>
          </label>
        )}

        <button className="btn-secondary w-full py-2.5" onClick={google} disabled={busy}>
          <Icon name="google" className="h-5 w-5" /> Continue with Google
        </button>

        <div className="my-5 flex items-center gap-3 text-xs text-muted">
          <span className="h-px flex-1 bg-border" /> or with email <span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label htmlFor="email" className="label">Email</label>
            <input id="email" type="email" autoComplete="email" required className="field" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label htmlFor="password" className="label">Password</label>
            <input
              id="password"
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              required
              minLength={mode === "signup" ? 8 : undefined}
              className="field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-danger" role="alert">{error}</p>}
          <button type="submit" className="btn-primary w-full py-2.5" disabled={busy}>
            {busy && <Icon name="loader" />}
            {mode === "signup" ? "Create account" : "Log in"}
          </button>
        </form>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-sm">
          {mode === "login" ? (
            <>
              <button className="text-primary underline" onClick={reset}>Forgot password?</button>
              <button className="text-primary underline" onClick={() => { setMode("signup"); setError(null); }}>Create an account</button>
            </>
          ) : (
            <button className="text-primary underline" onClick={() => { setMode("login"); setError(null); }}>I already have an account</button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Shown once after first sign-in so every user has a public username. */
export function ChooseUsername() {
  const { user, refresh, signOut } = useAuth();
  const [name, setName] = useState(() => (user?.displayName ?? user?.email?.split("@")[0] ?? "").replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20));
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
          <p className="mt-1 text-sm text-muted">This is how others see you. Don't use your full name if you'd rather stay private.</p>
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
