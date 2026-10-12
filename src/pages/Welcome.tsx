import { Link } from "react-router-dom";
import { Shell } from "../components/Layout";
import { Robot } from "../components/Robot";
import { useLang } from "../lib/i18n";

export function Welcome() {
  const { pick } = useLang();

  const headline = pick({ en: "Let's Discover How You See AI!", ar: "خلينا نكتشف إنت شايف الـ AI إزاي!" });
  const subtitle = pick({
    en: "Answer a few quick questions and tell us what you want to learn about AI.",
    ar: "جاوب على شوية أسئلة سريعة وقولنا إنت نفسك تتعلم إيه عن الـ AI معانا.",
  });
  const duration = pick({ en: "⏱️ Takes about 2–3 minutes", ar: "⏱️ بياخد من 2 لـ 3 دقايق" });
  const start = pick({ en: "Start the Survey", ar: "ابدأ الاستبيان" });
  const landingHelp = pick({
    en: "Your answers help our organizers plan the AI Track session just for you.",
    ar: "إجاباتك هتساعد منظمينا إنهم يجهزوا جلسة AI Track تناسبكم.",
  });
  const scanHint = pick({
    en: "Scan the QR on the projector screen, or use the link your organizer shared.",
    ar: "امسح كود QR اللي على شاشة البروجيكتور، أو استخدم اللينك اللي أرسله منظمكم.",
  });

  return (
    <Shell showHome={false}>
      <section className="mx-auto grid max-w-6xl items-center gap-8 md:grid-cols-[1.1fr_0.9fr]">
        {/* Text side */}
        <div className="text-center md:text-left">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-1.5 text-sm font-extrabold text-violet-600 shadow-sm ring-1 ring-violet-200">
            🎓 GDGoC AAST Aswan
          </span>

          <h1 className="mt-5 text-5xl font-extrabold leading-[1.05] sm:text-6xl">
            <span className="text-gradient">AI Through</span>{" "}
            <span className="text-gradient-warm">Your Eyes</span>
          </h1>

          <p className="mt-4 inline-block rounded-2xl bg-white/70 px-4 py-2 text-lg font-extrabold text-slate-700 shadow-sm ring-1 ring-pink-100">
            👁️ {headline}
          </p>

          <p className="mx-auto mt-4 max-w-xl text-lg font-medium leading-relaxed text-slate-600 md:mx-0">{subtitle}</p>
          <p className="mx-auto mt-2 max-w-xl text-base font-semibold text-slate-500 md:mx-0" dir="auto">
            {landingHelp}
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-4 md:justify-start">
            <Link to="/survey" className="btn-base btn-spin animate-pop">
              ✨ {start}
            </Link>
          </div>

          <p className="mt-4 text-sm font-bold text-violet-500">{duration}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">{scanHint}</p>
        </div>

        {/* Robot + illustrations */}
        <div className="relative mx-auto w-full max-w-sm">
          <div className="relative mx-auto flex h-64 w-64 items-center justify-center rounded-[3rem] bg-gradient-to-br from-pink-100 via-violet-100 to-sky-100 shadow-inner ring-4 ring-white">
            <Robot mood="wave" size={190} />
          </div>
          <div className="absolute -right-2 -top-2 animate-twinkle text-3xl">✨</div>
          <div className="absolute -left-4 top-10 animate-twinkle text-3xl" style={{ animationDelay: "0.6s" }}>🌟</div>
          <div className="absolute -right-6 bottom-16 animate-twinkle text-3xl" style={{ animationDelay: "1.1s" }}>💡</div>
          <div className="absolute -left-6 bottom-2 animate-twinkle text-2xl" style={{ animationDelay: "1.4s" }}>💫</div>

          {/* floating mini chips */}
          <div className="absolute -top-6 left-4 animate-pop rounded-2xl bg-white/90 px-3 py-1.5 text-xs font-extrabold text-pink-500 shadow ring-1 ring-pink-200">
            🤖 AI
          </div>
          <div className="absolute -bottom-5 right-2 animate-pop stagger-2 rounded-2xl bg-white/90 px-3 py-1.5 text-xs font-extrabold text-sky-500 shadow ring-1 ring-sky-200">
            🚀 Track
          </div>
        </div>
      </section>

      {/* What to expect */}
      <section className="mx-auto mt-16 max-w-5xl">
        <h2 className="text-center text-3xl font-extrabold text-slate-800">
          {pick({ en: "What to Expect?", ar: "إيه اللي مستنيك؟" })}
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { emoji: "📱", en: "Scan the QR code", ar: "امسح كود الـ QR" },
            { emoji: "🙋", en: "Answer 5 quick questions", ar: "جاوب على 5 أسئلة سريعة" },
            { emoji: "🎤", en: "Tell us what you want to learn", ar: "قولنا نفسك تتعلم إيه" },
            { emoji: "🚀", en: "We plan the AI Track for you", ar: "ونجهز AI Track ليكم" },
          ].map((step, i) => (
            <div
              key={step.en}
              className={`glass-card animate-fade-up stagger-${i + 1} rounded-3xl p-5 text-center transition-transform hover:-translate-y-1`}
            >
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-100 to-violet-100 text-3xl">
                {step.emoji}
              </div>
              <p className="mt-3 text-base font-extrabold text-slate-800" dir="auto">
                {pick(step)}
              </p>
            </div>
          ))}
        </div>
      </section>
    </Shell>
  );
}