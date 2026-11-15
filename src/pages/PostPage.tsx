import { useEffect, useState } from "react";
import { Icon } from "../components/Icons";
import { PostCard } from "../components/PostCard";
import { api, ApiError, type Post } from "../lib/api";
import { Link, useRouter } from "../lib/router";
import { useAuth } from "../lib/auth";

export function PostPage({ id }: { id: string }) {
  const [post, setPost] = useState<Post | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { navigate } = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    setError(null);
    api<{ post: Post }>(`/posts/${id}`).then((r) => setPost(r.post)).catch((e) => setError((e as ApiError).message));
  }, [id, user?.uid]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link to="/" className="btn-ghost mb-4 -ml-2"><Icon name="back" /> Back to feed</Link>
      {error && (
        <div className="card p-8 text-center">
          <p className="mb-4 text-muted">{error}</p>
          <Link to="/" className="btn-primary">Go to the live feed</Link>
        </div>
      )}
      {!error && !post && <div className="card h-48 animate-pulse" />}
      {post && <PostCard post={post} onChange={setPost} onRemove={() => navigate("/")} onBlock={() => navigate("/")} defaultOpenComments />}
    </div>
  );
}
