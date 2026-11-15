import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "../components/Icons";
import { BroadcastForm } from "../components/BroadcastForm";
import { PostCard } from "../components/PostCard";
import { TrendingPanel } from "../components/TrendingPanel";
import { api, ApiError, qs, type Post } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useLocation } from "../lib/location";
import { useToast } from "../lib/toast";

const RADII = [2, 5, 10, 25, 50];

export function Home() {
  const { user } = useAuth();
  const loc = useLocation();
  const toast = useToast();
  const [posts, setPosts] = useState<Post[]>([]);
  const [nextBefore, setNextBefore] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [near, setNear] = useState(false);
  const [radius, setRadius] = useState(10);
  const [fresh, setFresh] = useState<Post[]>([]);
  const [trendKey, setTrendKey] = useState(0);
  const postsRef = useRef<Post[]>([]);
  postsRef.current = posts;

  const filters = qs({ q, near: near && !!loc.coords, lat: loc.coords?.lat, lng: loc.coords?.lng, radius });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api<{ posts: Post[]; nextBefore: number | null }>(`/posts${filters}`);
      setPosts(r.posts);
      setNextBefore(r.nextBefore);
      setFresh([]);
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(); }, [load, user?.uid]);

  // debounce search box
  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 400);
    return () => clearTimeout(t);
  }, [search]);

  // check for new broadcasts every 20 seconds (only while the tab is visible)
  useEffect(() => {
    const t = setInterval(async () => {
      if (document.visibilityState !== "visible" || loading) return;
      try {
        const r = await api<{ posts: Post[] }>(`/posts${filters}`);
        const known = new Set(postsRef.current.map((p) => p.id));
        const newer = r.posts.filter((p) => !known.has(p.id) && p.createdAt > (postsRef.current[0]?.createdAt ?? 0));
        if (newer.length) setFresh(newer);
      } catch { /* offline, try again later */ }
    }, 20_000);
    return () => clearInterval(t);
  }, [filters, loading]);

  const more = async () => {
    if (!nextBefore) return;
    setLoadingMore(true);
    try {
      const r = await api<{ posts: Post[]; nextBefore: number | null }>(`/posts${filters}${filters ? "&" : "?"}before=${nextBefore}`);
      setPosts((p) => [...p, ...r.posts.filter((x) => !p.some((y) => y.id === x.id))]);
      setNextBefore(r.nextBefore);
    } catch (e) {
      toast("error", (e as ApiError).message);
    } finally {
      setLoadingMore(false);
    }
  };

  const toggleNear = async () => {
    if (near) return setNear(false);
    const c = loc.coords ?? (await loc.locate());
    if (c) setNear(true);
    else toast("error", "Couldn't get your location", "Allow location access to see what's happening near you.");
  };

  const update = (p: Post) => setPosts((xs) => xs.map((x) => (x.id === p.id ? p : x)));
  const remove = (id: string) => setPosts((xs) => xs.filter((x) => x.id !== id));
  const blockUser = (uid: string) => setPosts((xs) => xs.filter((x) => x.userId !== uid));

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      {!user && <Hero />}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          <BroadcastForm
            onPosted={(p) => {
              setPosts((xs) => [p, ...xs]);
              setTrendKey((k) => k + 1);
            }}
          />

          <div className="border-t border-border pt-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-xl font-semibold text-primary">
                <span className="ew-pulse inline-block h-2 w-2 rounded-full bg-accent" aria-hidden="true" /> Live Feed
              </h2>
              <button className="btn-ghost" onClick={load} aria-label="Refresh feed"><Icon name="refresh" /> Refresh</button>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              <div className="relative min-w-48 flex-1">
                <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" />
                <label htmlFor="feed-search" className="sr-only">Search broadcasts</label>
                <input id="feed-search" className="field pl-9" placeholder="Search keywords, #topics, places, people" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <button className={near ? "btn-primary" : "btn-secondary"} onClick={toggleNear} aria-pressed={near} disabled={loc.status === "locating"}>
                <Icon name={loc.status === "locating" ? "loader" : "locate"} /> Near me
              </button>
              {near && (
                <>
                  <label htmlFor="radius" className="sr-only">Distance</label>
                  <select id="radius" className="field w-auto" value={radius} onChange={(e) => setRadius(Number(e.target.value))}>
                    {RADII.map((r) => <option key={r} value={r}>Within {r} km</option>)}
                  </select>
                </>
              )}
            </div>

            {fresh.length > 0 && (
              <button
                className="btn-primary sticky top-20 z-30 mx-auto mb-4 flex shadow-lg"
                onClick={() => {
                  setPosts((xs) => [...fresh, ...xs.filter((x) => !fresh.some((f) => f.id === x.id))]);
                  setFresh([]);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                {fresh.length} new broadcast{fresh.length > 1 ? "s" : ""} — show
              </button>
            )}

            <div className="space-y-4">
              {loading && [0, 1, 2].map((i) => <div key={i} className="card h-36 animate-pulse" />)}
              {!loading && error && (
                <div className="card p-6 text-center">
                  <p className="mb-3 text-sm text-danger">{error}</p>
                  <button className="btn-secondary" onClick={load}>Try again</button>
                </div>
              )}
              {!loading && !error && posts.length === 0 && (
                <div className="card flex flex-col items-center gap-3 p-10 text-center">
                  <Icon name="wave" className="h-12 w-12 text-primary" />
                  <p className="text-lg font-semibold">It's quiet {near ? `within ${radius} km` : q ? "for that search" : "right now"}</p>
                  <p className="max-w-sm text-sm text-muted">
                    {near ? "Try a bigger distance, or be the first to share what's happening around you." : "Be the first to share what's happening around you."}
                  </p>
                </div>
              )}
              {!loading && posts.map((p) => <PostCard key={p.id} post={p} onChange={update} onRemove={remove} onBlock={blockUser} />)}
              {!loading && nextBefore && (
                <button className="btn-secondary w-full" onClick={more} disabled={loadingMore}>
                  {loadingMore ? <Icon name="loader" /> : null} Load older broadcasts
                </button>
              )}
            </div>
          </div>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <TrendingPanel near={near && !!loc.coords} lat={loc.coords?.lat} lng={loc.coords?.lng} radius={radius} refreshKey={trendKey} />
        </aside>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="relative mb-8 overflow-hidden rounded-3xl bg-hero p-6 text-white sm:p-10">
      <div className="pointer-events-none absolute -top-10 -right-10 h-72 w-72 rounded-full border border-white/25 sm:right-16 sm:top-10" aria-hidden="true" />
      <div className="pointer-events-none absolute -right-40 -bottom-40 h-[28rem] w-[28rem] rounded-full border border-white/10" aria-hidden="true" />
      <span className="inline-block rounded-full bg-accent/90 px-3 py-1 text-xs font-bold tracking-widest text-accent-fg uppercase">Live & AI-powered</span>
      <h1 className="mt-4 max-w-2xl text-4xl leading-tight font-black sm:text-5xl">
        Stay connected to your <span className="text-accent">Local Wave</span>
      </h1>
      <p className="mt-4 max-w-xl text-base text-white/90 sm:text-lg">
        Real-time updates from your community — traffic, weather, outages, deals and alerts — checked by AI for safety, sentiment and trending topics.
      </p>
      <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium">
        <li className="flex items-center gap-1.5"><Icon name="globe" /> Real-time</li>
        <li className="flex items-center gap-1.5"><Icon name="sparkles" /> AI moderation</li>
        <li className="flex items-center gap-1.5"><Icon name="pin" /> Near you</li>
        <li className="flex items-center gap-1.5"><Icon name="zap" /> Trending</li>
      </ul>
    </section>
  );
}
