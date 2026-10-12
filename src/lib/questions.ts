/**
 * AI Through Your Eyes — editable survey configuration.
 *
 * THIS IS THE ORGANIZER CONFIGURATION FILE.
 * Questions, options (English + Arabic), the multi-select behavior and the
 * final open-ended question live here. The dashboard and the student survey
 * are driven entirely by this file — no code changes needed to edit the
 * survey content.
 *
 * Each option has a stable `id` (stored in the database) so answers are
 * language-independent: the dashboard can render any student's answer in
 * either language.
 */

export interface Localized {
  en: string;
  ar: string;
}

export interface SurveyOption {
  /** Stable machine id — this is what gets saved in the database. */
  id: string;
  en: string;
  ar: string;
}

/** Column key used by the survey_submissions table. */
export type SurveyQuestionKey =
  | "question_1_answer"
  | "question_2_answer"
  | "question_3_answer"
  | "question_4_answer"
  | "question_5_answer";

export interface SurveyQuestion {
  key: SurveyQuestionKey;
  /** Index shown to students (1-based). */
  number: number;
  emoji: string;
  /** Main accent color used for the selected state. */
  color: string;
  /** Soft tint used for chips / bars. */
  light: string;
  question: Localized;
  multiSelect: boolean;
  /** Short organizer note shown as a tooltip in the dashboard. */
  purpose: Localized;
  options: SurveyOption[];
}

export interface SurveyFinalQuestion {
  key: "ai_track_expectations";
  emoji: string;
  color: string;
  light: string;
  title: Localized;
  question: Localized;
  supportingText: Localized;
  placeholder: Localized;
  maxLength: number;
}

/** The five multiple-choice questions, in order. */
export const SURVEY_QUESTIONS: SurveyQuestion[] = [
  {
    key: "question_1_answer",
    number: 1,
    emoji: "🧠",
    color: "#ec4899",
    light: "#fce7f3",
    question: {
      en: "What best describes your current understanding of Artificial Intelligence?",
      ar: "إيه أحسن وصف لمعرفتك الحالية بالذكاء الاصطناعي؟",
    },
    multiSelect: false,
    purpose: {
      en: "Students' current AI knowledge level.",
      ar: "مستوى معرفة الطلاب الحالي بالذكاء الاصطناعي.",
    },
    options: [
      { id: "new_to_ai", en: "I am completely new to AI", ar: "أنا جديد تمامًا على الـ AI" },
      { id: "basic_concepts", en: "I know the basic concepts", ar: "أعرف المفاهيم الأساسية" },
      { id: "use_tools_only", en: "I use AI tools but do not know how they work", ar: "بستخدم أدوات AI بس مش عارف شغالة إزاي" },
      { id: "understands_ml", en: "I understand some AI and Machine Learning concepts", ar: "فاهم بعض مفاهيم الـ AI والتعلم الآلي" },
      { id: "built_project", en: "I have already built an AI project", ar: "بنيت مشروع AI قبل كده" },
    ],
  },
  {
    key: "question_2_answer",
    number: 2,
    emoji: "🛠️",
    color: "#8b5cf6",
    light: "#ede9fe",
    question: {
      en: "Have you used any AI tools before?",
      ar: "استخدمت أدوات AI قبل كده؟",
    },
    multiSelect: false,
    purpose: {
      en: "How familiar students are with AI tools (ChatGPT, Copilot, Gemini…).",
      ar: "مدى تعود الطلاب على استخدام أدوات AI.",
    },
    options: [
      { id: "almost_every_day", en: "Yes, almost every day", ar: "أيوه، تقريبًا كل يوم" },
      { id: "sometimes", en: "Yes, sometimes", ar: "أيوه، أحيانًا" },
      { id: "once_or_twice", en: "I have tried them once or twice", ar: "جربتها مرة أو مرتين" },
      { id: "not_yet", en: "No, not yet", ar: "لأ، لسه" },
    ],
  },
  {
    key: "question_3_answer",
    number: 3,
    emoji: "🎯",
    color: "#0ea5e9",
    light: "#e0f2fe",
    question: {
      en: "Which of these tasks do you think AI can help with?",
      ar: "إيه المهام اللي تتوقع إن الـ AI يقدر يساعد فيها؟",
    },
    // Configure this to false to accept only one answer.
    multiSelect: true,
    purpose: {
      en: "Students' perception of AI capabilities (multi-select).",
      ar: "توقع الطلاب لقدرات الـ AI (اختيار متعدد).",
    },
    options: [
      { id: "answer_and_generate", en: "Answering questions and generating content", ar: "الإجابة عن الأسئلة وصناعة المحتوى" },
      { id: "analyze_and_patterns", en: "Analyzing data and finding patterns", ar: "تحليل البيانات واكتشاف الأنماط" },
      { id: "vision_and_language", en: "Recognizing images and understanding language", ar: "التعرف على الصور وفهم اللغة" },
      { id: "predictions_decisions", en: "Making predictions and supporting decisions", ar: "عمل توقعات ودعم القرارات" },
      { id: "all_of_the_above", en: "All of the above", ar: "كل ما سبق" },
    ],
  },
  {
    key: "question_4_answer",
    number: 4,
    emoji: "⚖️",
    color: "#10b981",
    light: "#d1fae5",
    question: {
      en: "Do you think AI can always provide correct and reliable answers?",
      ar: "هل الـ AI دايمًا بيدي إجابات صحيحة وموثوقة؟",
    },
    multiSelect: false,
    purpose: {
      en: "Students' awareness of AI limitations and hallucination.",
      ar: "وعي الطلاب بحدود الـ AI وإمكانية الخطأ.",
    },
    options: [
      { id: "always_correct", en: "Yes, AI is always correct", ar: "أيوه، الـ AI دايمًا صح" },
      { id: "usually_but_mistakes", en: "Usually, but it can make mistakes", ar: "في العادة، بس ممكن يغلط" },
      { id: "sometimes_biased", en: "No, AI can sometimes be incorrect or biased", ar: "لأ، ممكن يطلع إجابات غلط أو متحيزة" },
      { id: "not_sure", en: "I am not sure", ar: "مش متأكد" },
    ],
  },
  {
    key: "question_5_answer",
    number: 5,
    emoji: "🚀",
    color: "#f59e0b",
    light: "#fef3c7",
    question: {
      en: "Which AI topic interests you the most?",
      ar: "إيه أكتر مجال في الـ AI مهتم تتعلم عنه؟",
    },
    // Configure this to false to accept only one answer.
    multiSelect: true,
    purpose: {
      en: "Topics students most want to explore (multi-select).",
      ar: "المجالات اللي الطلاب مهتمين يستكشفوها (اختيار متعدد).",
    },
    options: [
      { id: "machine_learning", en: "Machine Learning", ar: "تعلم الآلة (Machine Learning)" },
      { id: "deep_learning", en: "Deep Learning and Neural Networks", ar: "التعلم العميق والشبكات العصبية" },
      { id: "generative_ai", en: "Generative AI and tools like ChatGPT", ar: "الذكاء الاصطناعي التوليدي وأدوات زي ChatGPT" },
      { id: "ai_agents", en: "AI Agents and Automation", ar: "وكلاء AI والأتمتة" },
      { id: "computer_vision", en: "Computer Vision and Image Recognition", ar: "الرؤية الحاسوبية ومعالجة الصور" },
      { id: "nlp", en: "Natural Language Processing", ar: "معالجة اللغات الطبيعية (NLP)" },
      { id: "building_projects", en: "Building real AI projects", ar: "بناء مشاريع AI حقيقية" },
      { id: "exploring", en: "I am not sure yet; I want to explore", ar: "مش متأكد لسه؛ عايز أستكشف" },
    ],
  },
];

/** The final open-ended question shown after question five. */
export const FINAL_QUESTION: SurveyFinalQuestion = {
  key: "ai_track_expectations",
  emoji: "🎤",
  color: "#0d9488",
  light: "#ccfbf1",
  title: { en: "Your Voice Matters!", ar: "صوتك مهم!" },
  question: {
    en: "What do you want to learn from the AI Track?",
    ar: "إيه أكتر حاجة نفسك تتعلمها أو تفهمها من الـ AI Track؟",
  },
  supportingText: {
    en: "Tell us what you expect from this track. Your answer will help us plan a session that matches your interests and needs.",
    ar: "قولنا نفسك تتعلم إيه، وإجابتك هتساعدنا نجهز Session تناسب اهتماماتكم واحتياجاتكم.",
  },
  placeholder: {
    en: "I want to learn how to…",
    ar: "نفسي أتعلم إزاي...",
  },
  maxLength: 500,
};

export const SURVEY_META = {
  community: "GDGoC AAST Aswan",
  title: { en: "AI Through Your Eyes", ar: "الـ AI بعينيك" },
  headline: { en: "Let's Discover How You See AI!", ar: "خلينا نكتشف إنت شايف الـ AI إزاي!" },
  subtitle: {
    en: "Answer a few quick questions and tell us what you want to learn about AI.",
    ar: "جاوب على شوية أسئلة سريعة وقولنا نفسك تتعلم إيه عن الـ AI معانا!",
  },
  duration: { en: "2–3 minutes", ar: "من 2 لـ 3 دقايق" },
};

/* ------------------------------------------------------------------
 * Lookup helpers used by the survey UI and the organizer dashboard.
 * ------------------------------------------------------------------ */

export function questionByKey(key: SurveyQuestionKey): SurveyQuestion {
  return SURVEY_QUESTIONS.find((q) => q.key === key) ?? SURVEY_QUESTIONS[0];
}

export function optionById(question: SurveyQuestion, id: string): SurveyOption {
  return question.options.find((o) => o.id === id) ?? { id, en: id, ar: id };
}

/** Localized label of a stored option id. */
export function optionLabel(key: SurveyQuestionKey, id: string, lang: "en" | "ar"): string {
  const q = questionByKey(key);
  return optionById(q, id)[lang];
}