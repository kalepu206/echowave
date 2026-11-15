import { Icon, WaveLogo } from "./Icons";
import { Link } from "../lib/router";
import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/theme";
import { NotificationBell } from "./NotificationBell";

export function Header() {
  const { user, profile } = useAuth();
  const { dark, toggle } = useTheme();
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4">
        <Link to="/" className="flex items-center gap-2 text-primary" aria-label="EchoWave home">
          <WaveLogo className="h-7 w-7" />
          <span className="text-xl font-bold tracking-tight sm:text-2xl">EchoWave</span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          <button className="btn-ghost" onClick={toggle} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}>
            <Icon name={dark ? "sun" : "moon"} className="h-5 w-5" />
          </button>
          {user ? (
            <>
              <NotificationBell />
              {profile?.isAdmin && (
                <Link to="/admin" className="btn-ghost" aria-label="Moderation">
                  <Icon name="shield" className="h-5 w-5" />
                </Link>
              )}
              <Link to="/me" className="btn-secondary px-3" aria-label="Your profile">
                <Icon name="user" className="h-4 w-4" />
                <span className="hidden max-w-[10rem] truncate sm:inline">{profile?.username ?? "Profile"}</span>
              </Link>
            </>
          ) : (
            <>
              <Link to="/login" className="btn-ghost">
                <Icon name="login" className="h-4 w-4" />
                <span>Login</span>
              </Link>
              <Link to="/login?mode=signup" className="btn-primary">
                <Icon name="userPlus" className="h-4 w-4" />
                <span>Sign Up</span>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-12 border-t border-border py-8 text-center text-xs text-muted">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-4 gap-y-2 px-4">
        <span>© {new Date().getFullYear()} EchoWave</span>
        <Link to="/guidelines" className="hover:text-fg">Community guidelines</Link>
        <Link to="/privacy" className="hover:text-fg">Privacy</Link>
        <Link to="/terms" className="hover:text-fg">Terms</Link>
        <Link to="/delete-account" className="hover:text-fg">Delete account</Link>
      </div>
    </footer>
  );
}
