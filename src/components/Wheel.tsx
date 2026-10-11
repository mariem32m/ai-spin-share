import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react";
import { CHALLENGES } from "../lib/challenges";
import type { ChallengeType } from "../lib/types";
import { computeWheelTarget, randomSegment, SEGMENT_ANGLE } from "../lib/wheelMath";
import { useLang } from "../lib/i18n";
import { wheelConfetti } from "../lib/confetti";

export interface WheelHandle {
  /** Spin and resolve with the challenge the wheel lands on (geometrically consistent). */
  spin: () => Promise<ChallengeType>;
  isSpinning: () => boolean;
}

const VIEW = 400;
const CENTER = VIEW / 2;
const WEDGE_R = 186;
const LABEL_R = 116;
const SPIN_MS = 4800;

function polar(angleDeg: number, radius: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: CENTER + radius * Math.sin(rad),
    y: CENTER - radius * Math.cos(rad),
  };
}

function wedgePath(start: number, end: number): string {
  const s = polar(start, WEDGE_R);
  const e = polar(end, WEDGE_R);
  return `M ${CENTER} ${CENTER} L ${s.x} ${s.y} A ${WEDGE_R} ${WEDGE_R} 0 0 1 ${e.x} ${e.y} Z`;
}

/** Split a wedge label onto up to two readable lines. */
function wrapWheelLabel(text: string): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = (current + " " + word).trim();
    if (next.length <= 16) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 2);
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Fixed pointer sitting at the top of the wheel. */
function WheelPointer() {
  return (
    <div className="wheel-pointer" aria-hidden="true">
      <svg viewBox="0 0 60 46" width="64" height="50">
        <path d="M30 4 L56 44 L30 36 L4 44 Z" fill="#7c3aed" stroke="#ffffff" strokeWidth="3" />
        <circle cx="30" cy="30" r="5" fill="#fde047" />
      </svg>
    </div>
  );
}

/** The complete wheel artwork as SVG (wedges, labels, ring, hub). */
function WheelSvg() {
  const { pick, lang } = useLang();

  return (
    <svg viewBox={`0 0 ${VIEW} ${VIEW}`} width="100%" height="100%" className="wheel-svg">
      <defs>
        <linearGradient id="wheelRing" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#facc15" />
          <stop offset="50%" stopColor="#2dd4bf" />
          <stop offset="100%" stopColor="#c4b5fd" />
        </linearGradient>
        <radialGradient id="wheelGloss" cx="0.38" cy="0.3" r="0.95">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="45%" stopColor="#ffffff" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="wheelDepth" cx="0.5" cy="0.5" r="0.5">
          <stop offset="96%" stopColor="#000000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.28" />
        </radialGradient>
      </defs>

      {/* wedges */}
      {CHALLENGES.map((c, i) => {
        const start = i * SEGMENT_ANGLE;
        const end = (i + 1) * SEGMENT_ANGLE;
        return <path key={c.type} d={wedgePath(start, end)} fill={c.color} stroke="#ffffff" strokeWidth="4" strokeLinejoin="round" />;
      })}

      {/* glossy sheen + depth */}
      <circle cx={CENTER} cy={CENTER} r={WEDGE_R} fill="url(#wheelGloss)" pointerEvents="none" />
      <circle cx={CENTER} cy={CENTER} r={WEDGE_R} fill="url(#wheelDepth)" pointerEvents="none" />

      {/* segment boundary dots */}
      {[0, 1, 2].map((i) => {
        const p = polar(i * SEGMENT_ANGLE, WEDGE_R - 16);
        return <circle key={i} cx={p.x} cy={p.y} r="8" fill="#ffffff" />;
      })}

      {/* wedge labels (kept horizontal at each segment centroid) */}
      {CHALLENGES.map((c, i) => {
        const angle = i * SEGMENT_ANGLE + SEGMENT_ANGLE / 2;
        const p = polar(angle, LABEL_R);
        const lines = wrapWheelLabel(pick(c.wheelLabel));
        const long = lines.some((l) => l.length > 13);
        return (
          <text
            key={c.type}
            x={p.x}
            y={p.y}
            textAnchor="middle"
            dominantBaseline="central"
            className="wheel-label-text"
            fill={c.dark}
            fontSize={long ? 12 : 13.5}
          >
            <tspan x={p.x} dy={-14} fontSize={25}>
              {c.emoji}
            </tspan>
            {lines.map((line, li) => (
              <tspan key={li} x={p.x} dy={li === 0 ? 20 : 15}>
                {line}
              </tspan>
            ))}
          </text>
        );
      })}

      {/* outer ring */}
      <circle cx={CENTER} cy={CENTER} r={WEDGE_R + 14} fill="none" stroke="url(#wheelRing)" strokeWidth="16" />
      <circle cx={CENTER} cy={CENTER} r={WEDGE_R + 9} fill="none" stroke="#ffffff" strokeWidth="3" opacity="0.7" />

      {/* center hub */}
      <circle cx={CENTER} cy={CENTER} r="52" fill="#ffffff" stroke="#c4b5fd" strokeWidth="5" />
      <text x={CENTER} y={CENTER - 6} textAnchor="middle" dominantBaseline="central" fontSize="30">
        🤖
      </text>
      <text
        x={CENTER}
        y={CENTER + 20}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="11"
        fontWeight="800"
        fill="#7c3aed"
        letterSpacing="1"
      >
        {lang === "ar" ? "لف العجلة" : "AI SPIN"}
      </text>
    </svg>
  );
}

/** Static decorative wheel (used on the welcome screen). */
export function WheelArt({ pointer = true, className }: { pointer?: boolean; className?: string }) {
  return (
    <div className={`relative aspect-square w-full select-none ${className ?? ""}`} aria-hidden="true">
      {pointer && <WheelPointer />}
      <WheelSvg />
    </div>
  );
}

/**
 * The interactive spinning wheel. `spin()` randomly selects a segment,
 * rotates to accommodate it under the pointer, and resolves with the
 * winning challenge type.
 */
export const Wheel = forwardRef<WheelHandle, { className?: string }>(function Wheel({ className }, ref) {
  const rotorRef = useRef<HTMLDivElement>(null);
  const rotationRef = useRef(0);
  const spinningRef = useRef(false);
  const [spinning, setSpinning] = useState(false);

  const isSpinning = useCallback(() => spinningRef.current, []);

  const spin = useCallback(
    () =>
      new Promise<ChallengeType>((resolve) => {
        if (spinningRef.current) return;
        spinningRef.current = true;
        setSpinning(true);

        // Random segment + enough full turns for a lively spin.
        const segment = randomSegment();
        const extraSpins = 4 + Math.floor(Math.random() * 3);
        const { nextRotation } = computeWheelTarget(rotationRef.current, segment, extraSpins);
        rotationRef.current = nextRotation;

        const finish = () => {
          spinningRef.current = false;
          setSpinning(false);
          wheelConfetti();
          resolve(CHALLENGES[segment].type);
        };

        // Reduced motion: jump to the result without animating.
        if (prefersReducedMotion()) {
          const rotor = rotorRef.current;
          if (rotor) {
            rotor.style.transition = "none";
            rotor.style.transform = `rotate(${nextRotation}deg)`;
          }
          window.setTimeout(finish, 120);
          return;
        }

        const rotor = rotorRef.current;
        if (!rotor) {
          finish();
          return;
        }

        // Small bounce/settle effect after the long rotation stops.
        let safetyTimer: ReturnType<typeof setTimeout> | undefined;

        const settle = () => {
          const target = rotationRef.current;
          const anim = rotor.animate(
            [
              { transform: `rotate(${target}deg)` },
              { transform: `rotate(${target - 12}deg)` },
              { transform: `rotate(${target}deg)` },
            ],
            { duration: 420, easing: "ease-out" },
          );
          anim.onfinish = finish;
        };

        const onTransitionEnd = (e: TransitionEvent) => {
          if (e.propertyName !== "transform") return;
          rotor.removeEventListener("transitionend", onTransitionEnd);
          if (safetyTimer) clearTimeout(safetyTimer);
          settle();
        };
        rotor.addEventListener("transitionend", onTransitionEnd);

        // Classic technique: flush current transform, then transition to target.
        rotor.style.transition = "none";
        rotor.style.transform = "rotate(0deg)";
        void rotor.offsetWidth; // force reflow so the new transition applies
        rotor.style.transition = `transform ${SPIN_MS}ms cubic-bezier(0.12, 0.78, 0.18, 1)`;
        rotor.style.transform = `rotate(${nextRotation}deg)`;

        // Safety net in case transitionend never fires (tab switch, etc.).
        safetyTimer = window.setTimeout(() => {
          rotor.removeEventListener("transitionend", onTransitionEnd);
          settle();
        }, SPIN_MS + 600);
      }),
    [],
  );

  useImperativeHandle(ref, () => ({ spin, isSpinning }));

  return (
    <div className={`relative aspect-square w-full select-none ${className ?? ""}`} role="group" aria-label="Spinning wheel">
      <WheelPointer />
      <div ref={rotorRef} className={`wheel-rotor ${spinning ? "is-spinning" : ""}`} style={{ transform: "rotate(0deg)", transition: "none" }}>
        <WheelSvg />
      </div>
    </div>
  );
});

export { SEGMENT_ANGLE };
export default Wheel;