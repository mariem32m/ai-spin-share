import type { CSSProperties } from "react";

export type RobotMood = "idle" | "wave" | "happy" | "excited" | "sad";

interface RobotProps {
  mood?: RobotMood;
  /** Approximate rendered width in px. */
  size?: number;
  className?: string;
  style?: CSSProperties;
}

/**
 * The one cute AI robot mascot used across the whole game.
 * Pure inline SVG + CSS animations — light and fast.
 */
export function Robot({ mood = "idle", size = 120, className, style }: RobotProps) {
  const moodClass =
    mood === "wave"
      ? "robot--wave"
      : mood === "happy"
        ? "robot--happy"
        : mood === "excited"
          ? "robot--excited"
          : mood === "sad"
            ? "robot--sad"
            : "";

  return (
    <div className={`robot ${moodClass} ${className ?? ""}`} style={{ width: size, ...style }} aria-hidden="true">
      <svg viewBox="0 0 220 220" width="100%" height="100%" role="presentation">
        <defs>
          <linearGradient id="robotHead" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="45%" stopColor="#e9e4ff" />
            <stop offset="100%" stopColor="#cdbcf8" />
          </linearGradient>
          <linearGradient id="robotBody" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a5b4fc" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>

        {/* antenna */}
        <line x1="110" y1="30" x2="110" y2="52" stroke="#8b5cf6" strokeWidth="6" strokeLinecap="round" />
        <circle className="robot-antenna" cx="110" cy="24" r="9" fill="#fde047" stroke="#f59e0b" strokeWidth="2" />

        {/* ears */}
        <rect x="40" y="76" width="14" height="34" rx="7" fill="#c4b5fd" />
        <rect x="166" y="76" width="14" height="34" rx="7" fill="#c4b5fd" />

        {/* head */}
        <rect x="52" y="44" width="116" height="98" rx="38" fill="url(#robotHead)" stroke="#8b5cf6" strokeWidth="4" />
        {/* glossy highlight */}
        <path d="M66 60 Q 74 50 90 52" stroke="#ffffff" strokeWidth="6" strokeLinecap="round" fill="none" opacity="0.9" />

        {/* eyes */}
        <g className="robot-eyes">
          <circle className="eye" cx="82" cy="90" r="10" fill="#312e81" />
          <circle className="eye" cx="138" cy="90" r="10" fill="#312e81" />
          <circle cx="85" cy="86" r="3" fill="#ffffff" />
          <circle cx="141" cy="86" r="3" fill="#ffffff" />
        </g>

        {/* cheeks */}
        <ellipse cx="68" cy="108" rx="9" ry="5" fill="#f9a8d4" opacity="0.85" />
        <ellipse cx="152" cy="108" rx="9" ry="5" fill="#f9a8d4" opacity="0.85" />

        {/* mouth per mood */}
        {mood === "sad" ? (
          <path d="M94 124 Q 110 110 126 124" stroke="#312e81" strokeWidth="5" strokeLinecap="round" fill="none" />
        ) : mood === "excited" ? (
          <path d="M92 114 Q 110 136 128 114 Z" fill="#312e81" />
        ) : (
          <path d="M92 116 Q 110 132 128 116" stroke="#312e81" strokeWidth="5" strokeLinecap="round" fill="none" />
        )}

        {/* arms */}
        <rect className="arm arm-left" x="34" y="142" width="16" height="46" rx="8" fill="#8b5cf6" />
        <rect className="arm arm-right" x="170" y="142" width="16" height="46" rx="8" fill="#8b5cf6" />

        {/* body */}
        <rect x="52" y="140" width="116" height="54" rx="26" fill="url(#robotBody)" stroke="#7c3aed" strokeWidth="3" />
        <circle cx="110" cy="167" r="15" fill="#ede9fe" />
        <text x="110" y="172" textAnchor="middle" fontSize="13" fontWeight="800" fill="#7c3aed">
          AI
        </text>

        {/* feet */}
        <rect x="74" y="196" width="28" height="12" rx="6" fill="#8b5cf6" />
        <rect x="118" y="196" width="28" height="12" rx="6" fill="#8b5cf6" />
      </svg>
    </div>
  );
}