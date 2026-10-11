import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { store, resolveSession } from "../lib/store";
import type { StoreMode, RealtimePayload } from "../lib/store";
import type { Submission, GameSession } from "../lib/types";

export interface WallState {
  submissions: Submission[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  mode: StoreMode;
  session: GameSession | null;
  /** Distinct student names (used as the wall's participant count). */
  participantCount: number;
}

/**
 * Shared real-time wall state: loads the active session, fetches its
 * submissions, then subscribes to live changes (Supabase postgres_changes
 * or demo-mode events / cross-tab sync).
 */
export function useSubmissions(): WallState {
  const [session, setSession] = useState<GameSession | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const sessionIdRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (!sessionIdRef.current) return;
    try {
      setError(null);
      const list = await store.getSubmissions(sessionIdRef.current);
      setSubmissions(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  // Resolve session once.
  useEffect(() => {
    let cancelled = false;
    resolveSession()
      .then((info) => {
        if (cancelled) return;
        sessionIdRef.current = info.session.id;
        setSession(info.session);
        setRefreshTick((t) => t + 1);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Initial load + subscribe. Re-subscribes when session resolves.
  useEffect(() => {
    if (!sessionIdRef.current) return;
    let disposed = false;

    const handlePayload = (p: RealtimePayload) => {
      if (disposed) return;
      const rec = p.submission;
      if (!rec || !rec.id) return;
      if (rec.session_id !== sessionIdRef.current) return;

      setSubmissions((prev) => {
        if (p.eventType === "DELETE") {
          return prev.filter((s) => s.id !== rec.id);
        }
        const exists = prev.some((s) => s.id === rec.id);
        if (exists) return prev.map((s) => (s.id === rec.id ? rec : s));
        // New remote submission — newest first, drop old items beyond a cap.
        return [rec, ...prev.filter((s) => s.id !== rec.id)].slice(0, 200);
      });
    };

    const handleList = (list: Submission[]) => {
      if (disposed) return;
      setSubmissions(list.slice(0, 200));
    };

    const unsubscribe = store.subscribe(sessionIdRef.current, handlePayload, handleList);

    setLoading(true);
    store
      .getSubmissions(sessionIdRef.current)
      .then((list) => {
        if (!disposed) setSubmissions(list);
      })
      .catch((e) => {
        if (!disposed) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });

    // Refetch when the tab becomes visible again (reconnection helper).
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        store
          .getSubmissions(sessionIdRef.current ?? "")
          .then((list) => {
            if (!disposed) setSubmissions(list);
          })
          .catch(() => undefined);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      disposed = true;
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refreshTick]);

  const participantCount = useMemo(() => {
    const names = new Set(submissions.map((s) => s.student_name.trim()).filter(Boolean));
    return names.size;
  }, [submissions]);

  return {
    submissions,
    loading,
    error,
    refresh,
    mode: store.mode,
    session,
    participantCount,
  };
}