import { Link } from "react-router-dom";
import { Shell } from "../components/Layout";
import { Robot } from "../components/Robot";
import { WheelArt } from "../components/Wheel";
import { useLang } from "../lib/i18n";

const STEPS = ["how.1", "how.2", "how.3", "how.4"];

export function Welcome() {
  const { t } = useLang();

  return (
    <Shell showHome={false}>
      <section className="mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-2">
        {/* Text side */}
        <div className="text-center md:text-left">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-1.5 text-sm font-extrabold text-violet-600 shadow-sm ring-1 ring-violet-200">
            🎓 {t("community.name")}
          </span>

          <h1 className="mt-5 text-5xl font-extrabold leading-[1.05] sm:text-6xl">
            <span className="text-gradient">AI Spin</span>{" "}
            <span className="text-gradient-warm">&amp; Share</span>
          </h1>

          <p className="mt-3 inline-block bg-gradient-to-r from-pink-500 via-violet-600 to-sky-500 bg-clip-text text-xl font-extrabold text-transparent">
            {t("tagline")}
          </p>

          <h2 className="mt-6 text-2xl font-extrabold text-slate-800 sm:text-3xl">
            {t("headline")}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-lg font-medium leading-relaxed text-slate-600 md:mx-0">
            {t("welcomeSubtitle")}
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4 md:justify-start">
            <Link to="/play" className="btn-base btn-spin animate-pop">
              🎡 {t("start.playing")}
            </Link>
            <Link to="/wall" className="btn-base btn-secondary animate-pop stagger-1">
              🧩 {t("view.wall")}
            </Link>
          </div>
        </div>

        {/* Wheel illustration */}
        <div className="relative mx-auto w-full max-w-md">
          <div className="wheel-deco pointer-events-none">
            <WheelArt pointer={false} />
          </div>
          <div className="absolute -bottom-4 -left-4 animate-pop stagger-2">
            <Robot mood="wave" size={110} />
          </div>
          <div className="absolute -right-2 -top-2 animate-twinkle text-3xl">✨</div>
          <div className="absolute -left-8 top-10 animate-twinkle text-2xl" style={{ animationDelay: "0.6s" }}>🌟</div>
          <div className="absolute -right-8 bottom-16 animate-twinkle text-2xl" style={{ animationDelay: "1.1s" }}>💡</div>
        </div>
      </section>

      {/* How to play */}
      <section className="mx-auto mt-16 max-w-5xl">
        <h2 className="text-center text-3xl font-extrabold text-slate-800">📜 {t("how.to.play")}</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((key, i) => {
            const emojis = ["🎡", "🤔", "✍️", "🧩"];
            return (
              <div
                key={key}
                className={`glass-card animate-fade-up stagger-${i + 1} rounded-3xl p-5 text-center transition-transform hover:-translate-y-1`}
              >
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-100 to-violet-100 text-3xl">
                  {emojis[i]}
                </div>
                <div className="mt-3 text-sm font-bold tracking-widest text-violet-400">
                  {t("how.to.play")} — {i + 1}
                </div>
                <p className="mt-1 text-base font-extrabold text-slate-800">{t(key)}</p>
              </div>
            );
          })}
        </div>
      </section>
    </Shell>
  );
}