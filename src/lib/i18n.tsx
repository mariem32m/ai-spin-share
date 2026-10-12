import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

export type Lang = "en" | "ar";

/** Dictionary of UI strings. Each entry carries English + Arabic. */
const STRINGS: Record<string, { en: string; ar: string }> = {
  "community.name": { en: "GDGoC AAST Aswan", ar: "GDGoC AAST Aswan" },
  "app.title": { en: "AI Through Your Eyes", ar: "الـ AI بعينيك" },
  "app.title.alt": { en: "AI Through Your Eyes", ar: "AI Through Your Eyes" },
  "wall.retry": { en: "Try Again", ar: "حاول تاني" },
  "wall.live": { en: "Live", ar: "لايف" },
  "demo.banner": {
    en: "Demo mode — ideas are saved on this device only and are not shared with other devices.",
    ar: "وضع تجريبي — الأفكار بتتحفظ على الجهاز ده بس ومش بتتشارك مع أجهزة تانية.",
  },
  "live.banner": { en: "Live mode — ideas sync across all devices in real time.", ar: "وضع لايف — الأفكار بتتزامن على كل الأجهزة مباشرة." },
  "host.title": { en: "Organizer Dashboard", ar: "لوحة تحكم المنظمين" },
  "host.login.title": { en: "Host Access", ar: "دخول المسؤول" },
  "host.password.label": { en: "Host password", ar: "باسورد المسؤول" },
  "host.password.placeholder": { en: "Enter the host password…", ar: "اكتب باسورد المسؤول…" },
  "host.login.btn": { en: "Unlock", ar: "فتح" },
  "host.auth.bad": { en: "Incorrect password.", ar: "الباسورد غلط." },
  "host.login.hint": {
    en: "Set VITE_HOST_HASH to enable moderation. Until then, the console is in presenter-only mode.",
    ar: "ظبط VITE_HOST_HASH عشان تفعّل التحكم. لحد كده لوحة التحكم في وضع العرض بس.",
  },
  "host.auth.account.tab": { en: "Organizer account", ar: "حساب المنظم" },
  "host.auth.password.tab": { en: "Host password", ar: "باسورد المسؤول" },
  "host.auth.email.label": { en: "Organizer email", ar: "إيميل المنظم" },
  "host.auth.email.placeholder": { en: "you@example.com", ar: "you@example.com" },
  "host.auth.signin.btn": { en: "Sign in to dashboard", ar: "سجّل دخول للوحة التحكم" },
  "host.auth.account.hint": {
    en: "Uses your Supabase Auth organizer account. Create it in Supabase → Auth → Users and set HOST_EMAILS on the Edge Function.",
    ar: "بيستخدم حساب المنظم على Supabase Auth. أنشئه من Supabase → Auth → Users وظبط HOST_EMAILS على الـ Edge Function.",
  },
  "host.copy": { en: "Copy", ar: "نسخ" },
  "host.copied": { en: "Copied!", ar: "اتنسخ!" },
  "host.present": { en: "Enter Fullscreen", ar: "شاشة كاملة" },
  "host.exit.present": { en: "Exit Fullscreen", ar: "خروج من الشاشة الكاملة" },
  "lang.en": { en: "English", ar: "English" },
  "lang.ar": { en: "عربي", ar: "عربي" },
  "mode.demo": { en: "Demo", ar: "تجريبي" },
  "mode.live": { en: "Live", ar: "لايف" },
  "back.home": { en: "Home", ar: "الرئيسية" },
  "host.logout": { en: "Lock console", ar: "قفل لوحة التحكم" },
  "error.title": { en: "Page not found", ar: "الصفحة مش موجودة" },
  "error.home": { en: "Go home", ar: "ارجع للرئيسية" },

  /* ================= New survey + dashboard strings ================= */

  /* --- Welcome / landing --- */
  "survey.meta.headline": { en: "Let's Discover How You See AI!", ar: "خلينا نكتشف إنت شايف الـ AI إزاي!" },
  "survey.meta.subtitle": {
    en: "Answer a few quick questions and tell us what you want to learn about AI.",
    ar: "جاوب على شوية أسئلة سريعة وقولنا إنت نفسك تتعلم إيه عن الـ AI معانا.",
  },
  "survey.meta.duration": { en: "⏱️ Takes about 2–3 minutes", ar: "⏱️ بياخد من 2 لـ 3 دقايق" },
  "survey.start": { en: "Start the Survey", ar: "ابدأ الاستبيان" },
  "survey.landing.help": {
    en: "Your answers help our organizers plan the AI Track session just for you.",
    ar: "إجاباتك هتساعد منظمينا إنهم يجهزوا جلسة AI Track تناسبكم.",
  },

  /* --- Survey flow --- */
  "survey.progress.question": { en: "Question", ar: "سؤال" },
  "survey.progress.of": { en: "of", ar: "من" },
  "survey.progress.final": { en: "Final question", ar: "السؤال الأخير" },
  "survey.select.one": { en: "Choose one answer", ar: "اختر إجابة واحدة" },
  "survey.select.many": { en: "Select all that apply", ar: "اختر كل اللي يناسبك" },
  "survey.back": { en: "Back", ar: "رجوع" },
  "survey.next": { en: "Next", ar: "التالي" },
  "survey.final.step": { en: "Part 2 · Your Voice", ar: "الجزء التاني · صوتك" },
  "survey.nickname.label": { en: "Nickname (optional)", ar: "اسم أو لقب (اختياري)" },
  "survey.nickname.placeholder": { en: "e.g. CuriousAya 🚀", ar: "مثلًا: Aya الفضولية 🚀" },
  "survey.expectations.label": { en: "Your expectations from the AI Track", ar: "توقعاتك من الـ AI Track" },
  "survey.submit": { en: "Submit Answers 🚀", ar: "إرسال الإجابات 🚀" },
  "survey.submitting": { en: "Saving…", ar: "بيتحفظ…" },
  "survey.req.answer": { en: "Please choose an answer to continue.", ar: "من فضلك اختر إجابة علشان تكمل." },
  "survey.req.expectations": { en: "Please tell us what you want to learn.", ar: "من فضلك اكتب إنت نفسك تتعلم إيه." },
  "survey.req.expectations.long": { en: "Please keep your answer to 500 characters or fewer.", ar: "من فضلك خلّي إجابتك 500 حرف أو أقل." },
  "survey.req.nickname.long": { en: "Nickname must be 50 characters or fewer.", ar: "الاسم لازم يكون 50 حرف أو أقل." },
  "survey.error.submit": {
    en: "Something went wrong while saving. Please check your connection and try again — your answers are safe.",
    ar: "حصل خطأ أثناء الحفظ. تأكد من اتصالك وجرب تاني — إجاباتك لسه محفوظة عندنا.",
  },
  "survey.retry": { en: "Try Again", ar: "حاول تاني" },
  "survey.privacy.note": {
    en: "🔒 Your responses are anonymous and are used by our organizers only — to understand student interests and plan the AI Track session.",
    ar: "🔒 إجاباتك مجهولة الهوية وبيستخدمها المنظمون بس — علشان نفهم اهتمامات الطلاب ونخطط لجلسة الـ AI Track.",
  },
  "survey.already.title": { en: "You've already shared your answers", ar: "شاركتنا إجاباتك قبل كده" },
  "survey.already.body": {
    en: "Thank you! Your responses were saved. You can return to the welcome page.",
    ar: "شكرًا ليك! إجاباتك اتحفظت. تقدر ترجع للصفحة الرئيسية.",
  },
  "survey.thank.title": { en: "Thank You for Sharing Your Ideas!", ar: "شكرًا إنك شاركتنا أفكارك!" },
  "survey.thank.body": {
    en: "Your answers will help us create a more useful and exciting AI Track experience.",
    ar: "إجاباتك هتساعدنا نجهز تجربة AI Track أفضل وأمتع ليكم.",
  },
  "survey.thank.confirmed": {
    en: "✅ Your responses were saved successfully.",
    ar: "✅ إجاباتك اتحفظت بنجاح.",
  },
  "survey.home": { en: "Back to Home", ar: "الرجوع للرئيسية" },

  /* --- Organizer dashboard --- */
  "dash.tagline": {
    en: "Review student answers and plan the AI Track session.",
    ar: "راجع إجابات الطلاب وجهز جلسة AI Track.",
  },
  "dash.scan.title": { en: "Scan to participate!", ar: "امسح علشان تشارك!" },
  "dash.join.link": { en: "Student survey link", ar: "لينك استبيان الطلاب" },
  "dash.share.note": {
    en: "Put this QR code on the projector — students scan it with their phones and answer in under 3 minutes.",
    ar: "حط كود الـ QR ده على البروجيكتور — الطلاب هيمسحوه بموبايلاتهم ويردوا في أقل من 3 دقايق.",
  },
  "dash.stats.total": { en: "Submissions", ar: "الردود" },
  "dash.stats.session": { en: "Session", ar: "الجلسة" },
  "dash.stats.named": { en: "With nickname", ar: "باسم" },
  "dash.responses.title": { en: "Individual responses", ar: "الردود الفردية" },
  "dash.responses.search": { en: "Search expectations or nicknames…", ar: "ابحث في التوقعات أو الأسماء…" },
  "dash.responses.filter": { en: "Filter", ar: "فلتر" },
  "dash.responses.all": { en: "All responses", ar: "كل الردود" },
  "dash.export": { en: "Export CSV", ar: "تصدير CSV" },
  "dash.exported": { en: "CSV downloaded!", ar: "تم تنزيل ملف CSV!" },
  "dash.empty": { en: "No responses yet. Share the QR code with your students!", ar: "لسه مفيش ردود. شارك كود الـ QR مع طلابك!" },
  "dash.loading": { en: "Loading responses…", ar: "بنجيب الردود…" },
  "dash.error": { en: "Couldn't load responses.", ar: "مقدرناش نجيب الردود." },
  "dash.live.note": { en: "Live — refreshes automatically every few seconds.", ar: "لايف — بيتحدث تلقائيًا كل شوية." },
  "dash.chart.many": { en: "Each student could choose more than one option.", ar: "كل طالب يقدر يختار أكتر من إجابة." },
  "dash.reset": { en: "Reset session", ar: "إعادة تعيين الجلسة" },
  "dash.reset.confirm": {
    en: "Start a new session? New submissions will go to a fresh session. Historical data is kept unless you permanently delete it.",
    ar: "تبدأ جلسة جديدة؟ الردود الجديدة هتتحفظ في جلسة جديدة. البيانات القديمة هتفضل محفوظة.",
  },
  "dash.delete": { en: "Permanently delete this session's data", ar: "حذف دائم لبيانات الجلسة دي" },
  "dash.delete.confirm": {
    en: "This permanently deletes ALL survey responses of this session. This cannot be undone. Type DELETE to confirm.",
    ar: "دي هتمسح كل ردود الجلسة نهائيًا ومش هترجع. اكتب DELETE للتأكيد.",
  },
  "dash.auth.need": {
    en: "Set VITE_HOST_HASH (the SHA-256 of the host password) and deploy the host-actions Edge Function to unlock the dashboard in live mode.",
    ar: "ظبط VITE_HOST_HASH وحمّل Edge Function علشان تفعّل لوحة التحكم في الوضع المباشر.",
  },
  "dash.demo.note": {
    en: "Demo mode — responses are stored in this browser only and are NOT shared between devices. Switch to Supabase for the live session.",
    ar: "وضع تجريبي — الردود بتتحفظ في المتصفح ده بس ومش بتتشارك بين الأجهزة. اربط Supabase للجلسة المباشرة.",
  },
  "dash.qr.local.warning": {
    en: "This QR points to a local preview address — devices on other networks can't open it. Set VITE_PUBLIC_BASE_URL to your deployed URL.",
    ar: "كود الـ QR ده بيشاور لعنوان محلي — الأجهزة التانية مش هتقدر تفتحه. ظبط VITE_PUBLIC_BASE_URL على رابطك المنشور.",
  },
  "dash.purpose.tip": { en: "Why we ask this", ar: "ليه بنسأل السؤال ده" },
};

interface LangContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  /** Read a dictionary key in the current language. */
  t: (key: string) => string;
  /** Pick a localized value. */
  pick: (v: { en: string; ar: string }) => string;
  dir: "ltr" | "rtl";
}

const LangContext = createContext<LangContextValue | null>(null);

const STORAGE_KEY = "aispinshare:lang";

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "ar" || saved === "en") return saved;
  } catch {
    /* ignore */
  }
  return "en";
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const dir: "ltr" | "rtl" = lang === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* ignore */
    }
  }, [lang, dir]);

  const setLang = useCallback((l: Lang) => setLangState(l), []);

  const value = useMemo<LangContextValue>(
    () => ({
      lang,
      setLang,
      dir,
      t: (key: string) => STRINGS[key]?.[lang] ?? key,
      pick: (v: { en: string; ar: string }) => v[lang],
    }),
    [lang, setLang, dir],
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): LangContextValue {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used inside <LangProvider>");
  return ctx;
}