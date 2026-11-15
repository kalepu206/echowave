import type { ComponentType } from "react";
import { Header, Footer } from "./components/Header";
import { Icon } from "./components/Icons";
import { AuthProvider, useAuth } from "./lib/auth";
import { LocationProvider } from "./lib/location";
import { Link, RouterProvider, useRouter } from "./lib/router";
import { ToastProvider } from "./lib/toast";
import { Home } from "./pages/Home";
import { Login, ChooseUsername } from "./pages/Login";
import { Profile } from "./pages/Profile";
import { PostPage } from "./pages/PostPage";
import { Admin } from "./pages/Admin";
import { DeleteAccountInfo, Guidelines, Privacy, Terms } from "./pages/Legal";

function Routes() {
  const { path } = useRouter();
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-primary" aria-label="Loading">
        <Icon name="wave" className="ew-pulse h-12 w-12" />
      </div>
    );
  }

  const legal: Record<string, ComponentType> = {
    "/privacy": Privacy,
    "/terms": Terms,
    "/guidelines": Guidelines,
    "/delete-account": DeleteAccountInfo,
  };
  if (legal[path]) {
    const Page = legal[path];
    return <Page />;
  }

  // signed in but no username yet: ask once
  if (user && profile && !profile.username) return <ChooseUsername />;

  if (profile?.banned) {
    return (
      <div className="card mx-auto my-10 max-w-md p-8 text-center">
        <h1 className="mb-2 text-xl font-bold text-danger">Account suspended</h1>
        <p className="text-sm text-muted">Your account was suspended for breaking the <Link to="/guidelines" className="underline">community guidelines</Link>. If you think this is a mistake, contact us from the <Link to="/terms" className="underline">Terms</Link> page.</p>
      </div>
    );
  }

  if (path === "/") return <Home />;
  if (path === "/login") return <Login />;
  if (path === "/me") return <Profile />;
  if (path === "/admin") return <Admin />;
  const m = path.match(/^\/p\/([a-f0-9-]{36})$/);
  if (m) return <PostPage id={m[1]} />;

  return (
    <div className="mx-auto my-16 max-w-md text-center">
      <Icon name="wave" className="mx-auto h-12 w-12 text-primary" />
      <h1 className="mt-3 text-2xl font-bold">Page not found</h1>
      <Link to="/" className="btn-primary mt-6">Back to the live feed</Link>
    </div>
  );
}

export default function App() {
  return (
    <RouterProvider>
      <ToastProvider>
        <AuthProvider>
          <LocationProvider>
            <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-card focus:p-2">Skip to content</a>
            <Header />
            <main id="main" className="min-h-[70vh]">
              <Routes />
            </main>
            <Footer />
          </LocationProvider>
        </AuthProvider>
      </ToastProvider>
    </RouterProvider>
  );
}
