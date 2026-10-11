import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

export type Lang = "en" | "ar";

/** Dictionary of UI strings. Each entry carries English + Arabic. */
const STRINGS: Record<string, { en: string; ar: string }> = {
  "community.name": { en: "GDGoC AAST Aswan", ar: "GDGoC AAST Aswan" },
  "app.title": { en: "AI Spin & Share", ar: "AI سبين آند شير" },
  "app.title.alt": { en: "AI Spin & Share", ar: "AI Spin & Share" },
  headline: { en: "Spin to Get Your Challenge!", ar: "لف علشان تاخد التحدي بتاعك!" },
  welcomeSubtitle: {
    en: "Everyone sees AI differently. Spin the wheel, share your ideas, and discover what AI can do!",
    ar: "كل واحد فينا بيشوف الـ AI بطريقة مختلفة! لف العجلة، شارك فكرتك، واكتشف إمكانيات الذكاء الاصطناعي.",
  },
  tagline: { en: "Spin the Wheel. Share Your Ideas. Imagine the Future.", ar: "لف العجلة، شارك أفكارك، وتخيل المستقبل." },
  "start.playing": { en: "Start Playing", ar: "ابدأ اللعب" },
  "view.wall": { en: "View Community Wall", ar: "شاهد حائط الأفكار" },
  "how.to.play": { en: "How to Play", ar: "إزاي تلعب" },
  "how.1": { en: "Spin the wheel", ar: "لف العجلة" },
  "how.2": { en: "Discover your AI challenge", ar: "اكتشف تحدي الـ AI بتاعك" },
  "how.3": { en: "Enter your name and share your answer", ar: "اكتب اسمك وشارك إجابتك" },
  "how.4": { en: "See your idea on the community wall", ar: "شوف فكرتك على حائط المجتمع" },
  "spin.button": { en: "SPIN!", ar: "لف!" },
  "spin.hint": { en: "Click SPIN to rotate the wheel!", ar: "دوس لف علشان العجلة تدور!" },
  "wheel.labels.title": { en: "Your Challenge", ar: "التحدي بتاعك" },
  "wheel.again.title": { en: "The Wheel Picked…", ar: "العجلة اختارت…" },
  "continue.button": { en: "Continue", ar: "كمّل" },
  "form.title": { en: "Share Your Idea", ar: "شارك فكرتك" },
  "form.name.label": { en: "Your Name", ar: "اسمك" },
  "form.name.placeholder": { en: "Enter your name here…", ar: "اكتب اسمك هنا…" },
  "form.answer.label": { en: "Your Answer", ar: "إجابتك" },
  "form.answer.placeholder": {
    en: "Write your answer here…",
    ar: "اكتب إجابتك هنا…",
  },
  "form.submit": { en: "SUBMIT MY ANSWER", ar: "ابعت إجابتك" },
  "form.loading": { en: "Saving…", ar: "بيتحفظ…" },
  "form.challenge": { en: "Your challenge", ar: "التحدي بتاعك" },
  "req.name": { en: "Please enter your name.", ar: "من فضلك اكتب اسمك." },
  "req.answer": { en: "Please write an answer.", ar: "من فضلك اكتب إجابة." },
  "len.name": { en: "Name must be 50 characters or fewer.", ar: "الاسم لازم يكون 50 حرف أو أقل." },
  "len.answer": { en: "Answer must be 500 characters or fewer.", ar: "الإجابة لازم تكون 500 حرف أو أقل." },
  "error.submit": {
    en: "Something went wrong while saving. Please check your connection and try again.",
    ar: "حصل خطأ أثناء الحفظ. تأكد من اتصالك وجرب تاني.",
  },
  "success.title": { en: "Your idea is now part of the AI community!", ar: "فكرتك بقت جزء من مجتمع الـ AI!" },
  "success.thanks": { en: "Thanks for sharing,", ar: "شكراً لمشاركتك يا" },
  "success.confirmation": { en: "This is what you shared:", ar: "دي اللي شاركته:" },
  "success.wall": { en: "View Community Wall", ar: "شاهد حائط الأفكار" },
  "success.again": { en: "Play Again", ar: "العب تاني" },
  "success.finish": { en: "Finish", ar: "إنهاء" },
  "wall.title": { en: "The AI Idea Wall", ar: "حائط أفكار الـ AI" },
  "wall.subtitle": {
    en: "One Community. A Thousand AI Ideas.",
    ar: "مجتمع واحد، وأفكار كتير عن مستقبل الـ AI!",
  },
  "wall.discover": {
    en: "Discover how your fellow students imagine the future of AI.",
    ar: "اكتشف إزاي زملاءك بيتخيلوا مستقبل الذكاء الاصطناعي.",
  },
  "wall.empty": {
    en: "No ideas yet! Spin the wheel and be the first to share.",
    ar: "لسه مفيش أفكار! لف العجلة وكن أول واحد يشارك.",
  },
  "wall.loading": { en: "Loading the wall…", ar: "بنجيب الأفكار…" },
  "wall.error": {
    en: "Couldn't load the wall. Check your connection and try again.",
    ar: "مقدرناش نحمل الحائط. تأكد من الاتصال وجرب تاني.",
  },
  "wall.retry": { en: "Try Again", ar: "حاول تاني" },
  "wall.filter.all": { en: "All Ideas", ar: "كل الأفكار" },
  "wall.ideas": { en: "Ideas", ar: "فكرة" },
  "wall.participants": { en: "Participants", ar: "مشارك" },
  "wall.live": { en: "Live", ar: "لايف" },
  "demo.banner": {
    en: "Demo mode — ideas are saved on this device only and are not shared with other devices.",
    ar: "وضع تجريبي — الأفكار بتتحفظ على الجهاز ده بس ومش بتتشارك مع أجهزة تانية.",
  },
  "live.banner": { en: "Live mode — ideas sync across all devices in real time.", ar: "وضع لايف — الأفكار بتتزامن على كل الأجهزة مباشرة." },
  "wall.back": { en: "Back to Game", ar: "ارجع للعبة" },
  "recruit.title": { en: "Your Ideas Are Just the Beginning!", ar: "أفكارك ممكن تكون بداية لحاجة أكبر!" },
  "recruit.body": {
    en: "You don't need to be an AI expert to start building with AI. Bring your curiosity, explore new possibilities, and learn how to turn your ideas into real projects with the AI Track.",
    ar: "مش لازم تكون خبير AI عشان تبدأ. كل اللي محتاجه هو الفضول والرغبة إنك تتعلم وتحول أفكارك لمشاريع حقيقية.",
  },
  "recruit.explore": { en: "Explore the AI Track", ar: "اكتشف AI Track" },
  "recruit.ideas": { en: "View Community Ideas", ar: "شاهد أفكار المجتمع" },
  "recruit.play": { en: "Play Again", ar: "العب تاني" },
  "recruit.no.link": {
    en: "The registration link isn't set yet — ask an organizer to join the AI Track!",
    ar: "اللينك مش متظبط لسه — اسأل المنظمين عشان تنضم لـ AI Track!",
  },
  "recruit.summary": { en: "Imagine, share, and build with AI", ar: "تخيل، شارك، وابنِ بالـ AI" },
  "host.title": { en: "Host Console", ar: "لوحة التحكم" },
  "host.login.title": { en: "Host Access", ar: "دخول المسؤول" },
  "host.password.label": { en: "Host password", ar: "باسورد المسؤول" },
  "host.password.placeholder": { en: "Enter the host password…", ar: "اكتب باسورد المسؤول…" },
  "host.login.btn": { en: "Unlock", ar: "فتح" },
  "host.auth.bad": { en: "Incorrect password.", ar: "الباسورد غلط." },
  "host.login.hint": {
    en: "Set VITE_HOST_HASH to enable moderation. Until then, the console is in presenter-only mode.",
    ar: "ظبط VITE_HOST_HASH عشان تفعّل التحكم. لحد كده لوحة التحكم في وضع العرض بس.",
  },
  "host.join.link": { en: "Student join link", ar: "لينك مشاركة الطلاب" },
  "host.copy": { en: "Copy", ar: "نسخ" },
  "host.copied": { en: "Copied!", ar: "اتنسخ!" },
  "host.scan": { en: "Scan to play", ar: "امسح علشان تلعب" },
  "host.open.wall": { en: "Open Community Wall", ar: "افتح حائط الأفكار" },
  "host.join.note": { en: "Share this link so students can join from their phones.", ar: "شارك اللينك ده عشان الطلاب يشاركوا من موبايلاتهم." },
  "host.moderate.title": { en: "Moderation", ar: "التحكم في الردود" },
  "host.no.subs": { en: "No submissions yet.", ar: "لسه مفيش ردود." },
  "host.hide": { en: "Hide", ar: "إخفاء" },
  "host.restore": { en: "Restore", ar: "استرجاع" },
  "host.highlight": { en: "Show on screen", ar: "اعرض على الشاشة" },
  "host.highlighting": { en: "★ On screen", ar: "★ على الشاشة" },
  "host.clear.screen": { en: "Clear highlighted card", ar: "امسح البطاقة" },
  "host.present": { en: "Enter Fullscreen", ar: "شاشة كاملة" },
  "host.exit.present": { en: "Exit Fullscreen", ar: "خروج من الشاشة الكاملة" },
  "host.reset": { en: "Reset session", ar: "إعادة تعيين الجلسة" },
  "host.reset.confirm": {
    en: "Start a new session? New submissions will go to a fresh session. Historical data is kept unless you permanently delete it.",
    ar: "تبدأ جلسة جديدة؟ الردود الجديدة هتتحفظ في جلسة جديدة. البيانات القديمة هتفضل محفوظة.",
  },
  "host.delete": { en: "Permanently delete this session's data", ar: "حذف دائم لبيانات الجلسة دي" },
  "host.delete.confirm": {
    en: "This permanently deletes ALL submissions of this session. This cannot be undone. Type DELETE to confirm.",
    ar: "دي هتمسح كل ردود الجلسة نهائياً ومش هترجع. اكتب DELETE للتأكيد.",
  },
  "host.config.title": { en: "Session configuration", ar: "إعدادات الجلسة" },
  "host.config.repeat": { en: "Allow repeated participation", ar: "السماح بتكرار المشاركة" },
  "host.config.regurl": { en: "AI Track registration URL", ar: "لينك التسجيل في AI Track" },
  "host.config.save": { en: "Save configuration", ar: "حفظ الإعدادات" },
  "host.config.saved": { en: "Configuration saved!", ar: "الإعدادات اتسجلت!" },
  "host.force.wall": { en: "Open wall in a new tab", ar: "افتح الحائط في تبويب جديد" },
  "host.demo.note": {
    en: "Presenter mode active (host password not configured). Open the wall tab to operate this browser as a second player.",
    ar: "وضع العرض مفعّل (مفيش باسورد متظبط). افتح تبويب الحائط عشان تشتغل كلاعب تاني من نفس المتصفح.",
  },
  "host.participant.count": { en: "Participants", ar: "المشاركون" },
  "lang.en": { en: "English", ar: "English" },
  "lang.ar": { en: "عربي", ar: "عربي" },
  "mode.demo": { en: "Demo", ar: "تجريبي" },
  "mode.live": { en: "Live", ar: "لايف" },
  "back.home": { en: "Home", ar: "الرئيسية" },
  "already.participated": {
    en: "You already shared an idea this session. You can view the wall or wait for the next game!",
    ar: "أنت شاركت فكرة قبل كده في الجلسة دي. تقدر تشوف الحائط أو تستنى الجولة الجاية!",
  },
  "form.characters": { en: "characters", ar: "حرف" },
  "misc.time.justnow": { en: "just now", ar: "اللحظة دي" },
  "host.logout": { en: "Lock console", ar: "قفل لوحة التحكم" },
  "wheel.ar.warning": { en: "Labels rotate with the wheel.", ar: "العلامات بتلف مع العجلة." },
  "error.title": { en: "Page not found", ar: "الصفحة مش موجودة" },
  "error.home": { en: "Go home", ar: "ارجع للرئيسية" },
  "host.subs.count": { en: "Submissions", ar: "الردود" },
  "misc.prevent.close": { en: "Don't leave!", ar: "متسبش اللعب!" },
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