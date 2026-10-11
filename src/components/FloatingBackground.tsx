import { useMemo } from "react";
import type { CSSProperties } from "react";

interface FgItem {
  id: number;
  x: number;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
  kind: "emoji" | "bubble";
  char?: string;
}

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/** Fixed, decorative, non-interactive background animation. */
export function FloatingBackground() {
  const items = useMemo<FgItem[]>(() => {
    const emojis = ["✨", "⭐", "💡", "🌟", "💫", "🤖", "🚀", "🧠", "🦄", "🌈"];
    const list: FgItem[] = [];
    for (let i = 0; i < 18; i++) {
      if (i % 5 === 2) {
        list.push({
          id: i,
          x: rand(3, 94),
          size: rand(60, 120),
          duration: rand(80, 140),
          delay: rand(0, 40),
          opacity: 0.6,
          kind: "bubble",
        });
      } else {
        list.push({
          id: i,
          x: rand(3, 94),
          size: rand(16, 32),
          duration: rand(55, 110),
          delay: rand(0, 50),
          opacity: rand(0.3, 0.65),
          kind: "emoji",
          char: emojis[i % emojis.length],
        });
      }
    }
    return list;
  }, []);

  const itemStyle = (item: FgItem): CSSProperties => {
    const style: CSSProperties & Record<string, string> = {
      "--x": `${item.x}%`,
      "--size": `${item.size}px`,
      "--opacity": String(item.opacity),
      animationDuration: `${item.duration}s`,
      animationDelay: `${item.delay}s`,
    };
    return style;
  };

  return (
    <div className="floating-bg" aria-hidden="true">
      {/* soft clouds */}
      <div className="cloud" style={{ left: "6%", top: "10%", width: 90, height: 26 }} />
      <div className="cloud" style={{ right: "8%", top: "16%", width: 130, height: 34 }} />
      <div className="cloud" style={{ left: "42%", top: "6%", width: 70, height: 22 }} />

      {items.map((item) =>
        item.kind === "emoji" ? (
          <span key={item.id} style={itemStyle(item)}>
            {item.char}
          </span>
        ) : (
          <span key={item.id} className="bubble" style={itemStyle(item)} />
        ),
      )}
    </div>
  );
}