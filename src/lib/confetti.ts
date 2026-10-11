import confetti from "canvas-confetti";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Small, quick burst used when the wheel stops. */
export function wheelConfetti(): void {
  if (prefersReducedMotion()) return;
  confetti({
    particleCount: 60,
    spread: 70,
    origin: { y: 0.6 },
    colors: ["#facc15", "#2dd4bf", "#c4b5fd", "#f9a8d4", "#38bdf8"],
    scalar: 0.9,
    ticks: 120,
  });
}

/** Big celebration used after a successful submission. */
export function celebrateConfetti(): void {
  if (prefersReducedMotion()) return;
  const defaults = { colors: ["#facc15", "#2dd4bf", "#c4b5fd", "#f9a8d4", "#38bdf8", "#fef08a"] };
  confetti({ ...defaults, particleCount: 120, spread: 100, origin: { y: 0.6 } });
  setTimeout(() => {
    confetti({ ...defaults, particleCount: 80, angle: 60, spread: 70, origin: { x: 0 } });
    confetti({ ...defaults, particleCount: 80, angle: 120, spread: 70, origin: { x: 1 } });
  }, 250);
}