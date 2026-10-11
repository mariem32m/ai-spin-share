import type { ChallengeType } from "./types";

export interface Localized {
  en: string;
  ar: string;
}

export interface Challenge {
  type: ChallengeType;
  /** Short label shown on the wheel wedge. */
  wheelLabel: Localized;
  title: Localized;
  /** Full question shown in the challenge card and the form. */
  question: Localized;
  /** Encouraging line shown with the challenge. */
  encouragement: Localized;
  emoji: string;
  /** Main wedge color. */
  color: string;
  /** Light tint for cards / chips. */
  light: string;
  /** Dark readable accent on top of `color`. */
  dark: string;
}

/** The three lawful challenge categories used everywhere in the app. */
export const CHALLENGES: Challenge[] = [
  {
    type: "ai_is",
    wheelLabel: { en: "AI Is…", ar: "الـ AI هو…" },
    title: { en: "AI Is…", ar: "الـ AI هو…" },
    question: {
      en: "Complete this sentence: To me, AI is…",
      ar: "كمّل الجملة: بالنسبة لي، الـ AI هو…",
    },
    encouragement: {
      en: "Let's see how your mind imagines AI! ✨",
      ar: "خلينا نشوف خيالك عن الـ AI! ✨",
    },
    emoji: "🧠",
    color: "#facc15",
    light: "#fef9c3",
    dark: "#713f12",
  },
  {
    type: "my_ai_story",
    wheelLabel: { en: "My AI Story", ar: "قصتي مع الـ AI" },
    title: { en: "My AI Story", ar: "قصتي مع الـ AI" },
    question: {
      en: "What's the most useful, surprising, or unusual thing you've ever done with AI?",
      ar: "إيه أكتر حاجة مفيدة أو غريبة استخدمت فيها AI؟",
    },
    encouragement: {
      en: "Every AI experience tells a story! 💬",
      ar: "كل تجربة مع الـ AI ليها قصة! 💬",
    },
    emoji: "💬",
    color: "#2dd4bf",
    light: "#ccfbf1",
    dark: "#134e4a",
  },
  {
    type: "if_i_built_ai",
    wheelLabel: { en: "If I Could Build an AI…", ar: "لو أبني AI…" },
    title: { en: "If I Could Build an AI…", ar: "لو أبني AI…" },
    question: {
      en: "If you could build an AI to solve one problem in your life or community, what would it do?",
      ar: "لو تقدر تبني AI يحل مشكلة واحدة في حياتك أو مجتمعك، هتخليه يعمل إيه؟",
    },
    encouragement: {
      en: "Dream big! Your idea could become a real AI project! 🚀",
      ar: "احلم كبر! فكرتك ممكن تبقى مشروع AI حقيقي! 🚀",
    },
    emoji: "🚀",
    color: "#c4b5fd",
    light: "#ede9fe",
    dark: "#4c1d95",
  },
];

export function challengeByType(type: ChallengeType): Challenge {
  return CHALLENGES.find((c) => c.type === type) ?? CHALLENGES[0];
}