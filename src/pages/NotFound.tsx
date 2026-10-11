import { useCallback } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { Shell } from "../components/Layout";
import { Robot } from "../components/Robot";
import { useLang } from "../lib/i18n";

export function NotFound() {
  const { t } = useLang();
  const goBack = useCallback((e: FormEvent) => {
    e.preventDefault();
    if (window.history.length > 1) window.history.back();
    else window.location.assign("/");
  }, []);

  return (
    <Shell>
      <div className="mx-auto max-w-md pt-10 text-center">
        <Robot mood="sad" size={120} />
        <h1 className="text-gradient mt-4 text-3xl font-extrabold">404</h1>
        <p className="mt-2 text-lg font-bold text-slate-600">{t("error.title")}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link to="/" className="btn-base btn-spin">
            🏠 {t("error.home")}
          </Link>
          <button type="button" onClick={goBack} className="btn-base btn-secondary">
            ⬅️ {t("back.home")}
          </button>
        </div>
      </div>
    </Shell>
  );
}