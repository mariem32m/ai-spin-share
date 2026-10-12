import { useCallback, useEffect, useRef, useState } from "react";
import { store, resolveSession } from "../lib/store";
import type { StoreMode, RealtimePayload } from "../lib/store";
import type { GameSession, SurveySubmission } from "../lib/types";

export interface SurveyState {
  responses: SurveySubmission[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  mode: StoreMode;
  session: GameSession | null;
}

/**
 * Dashboard data hook: resolves the active session, loads every survey
 * response, then stays live.
 *
 * - Demo mode (localStorage): listens to in-memory events + cross-tab
 *   storage events for instant updates.
 * - Live mode (Supabase): survey data is private, so it is fetched through
 *   the protected `host-actions` Edge Function and polled periodically.
 */
export function useSurveyResponses(pollMs = 5000): SurveyState {
  const [session, setSession] = useState<GameSession | null>(null);
  const [responses, setResponses] = useState<SurveySubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (!sessionIdRef.current) return;
    try {
      setError(null);
      const list = await store.listSurveys(sessionIdRef.current);
      setResponses(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  // Resolve the session once, then run an initial load.
  useEffect(() => {
    let cancelled = false;
    resolveSession()
      .then((info) => {
        if (cancelled) return;
        sessionIdRef.current = info.session.id;
        setSession(info.session);
        return load();
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
  }, [load]);

  // Live updates: demo event bus + periodic polling (also covers Supabase).
  useEffect(() => {
    if (!sessionIdRef.current) return;
    let disposed = false;

    const handlePayload = (p: RealtimePayload) => {
      if (disposed) return;
      const rec = p.submission;
      if (!rec || rec.session_id !== sessionIdRef.current) return;
      setResponses((prev) => {
        if (p.eventType === "DELETE") return prev.filter((s) => s.id !== rec.id);
        const exists = prev.some((s) => s.id === rec.id);
        if (exists) return prev.map((s) => (s.id === rec.id ? rec : s));
        return [rec, ...prev.filter((s) => s.id !== rec.id)];
      });
    };

    const handleList = (list: SurveySubmission[]) => {
      if (!disposed) setResponses(list);
    };

    const unsubscribe = store.subscribe(sessionIdRef.current, handlePayload, handleList);

    const timer = window.setInterval(() => {
      void load();
    }, pollMs);

    const onVisibility = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      disposed = true;
      unsubscribe();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [load, pollMs]);

  const refresh = useCallback(async () => {
    await load();
  }, [load]);

  return {
    responses,
    loading,
    error,
    refresh,
    mode: store.mode,
    session,
  };
}