import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { Icon } from "../components/Icons";

type Kind = "success" | "error" | "info";
interface Toast { id: number; kind: Kind; title: string; body?: string }

const Ctx = createContext<(kind: Kind, title: string, body?: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((kind: Kind, title: string, body?: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, kind, title, body }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 7000 : 4000);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="card pointer-events-auto flex w-full max-w-sm items-start gap-3 p-4 shadow-lg">
            <Icon
              name={t.kind === "success" ? "check" : t.kind === "error" ? "alert" : "info"}
              className={`mt-0.5 h-5 w-5 shrink-0 ${t.kind === "success" ? "text-success" : t.kind === "error" ? "text-danger" : "text-primary"}`}
            />
            <div>
              <p className="text-sm font-semibold">{t.title}</p>
              {t.body && <p className="mt-0.5 text-sm text-muted">{t.body}</p>}
            </div>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
