// =====================================================================
// Wheel math unit tests — no browser needed.
// Run: npm run test:wheel   (needs Node ≥ 22.18 for TS type-stripping)
// =====================================================================
import {
  computeWheelTarget,
  pointerAngle,
  randomSegment,
  segmentUnderPointer,
  SEGMENT_ANGLE,
  SEGMENT_COUNT,
} from "../src/lib/wheelMath.ts";

let failures = 0;
const check = (name, cond) => {
  if (!cond) {
    failures++;
    console.error("  FAIL:", name);
  }
};

// 1) Neighborhood: selection roughly uniform over many spins.
{
  const counts = [0, 0, 0];
  for (let i = 0; i < 9000; i++) counts[randomSegment()]++;
  const ok = counts.every((c) => Math.abs(c - 3000) < 350);
  check(`selection distribution approx uniform (got ${counts.join(", ")})`, ok);
}

// 2) For every segment and many starting rotations: the computed target
//    rotation lands EXACTLY on the requested segment under the pointer.
for (let seg = 0; seg < 3; seg++) {
  for (let r = 0; r < 600; r++) {
    const start = (Math.random() - 0.5) * 10000;
    const { nextRotation, targetReading } = computeWheelTarget(start, seg, 5, () => 0.5);
    const expectedReading = seg * SEGMENT_ANGLE + SEGMENT_ANGLE / 2;
    check(`seg ${seg} deterministic centre`, Math.round(targetReading) === expectedReading);
    const reading = pointerAngle(nextRotation);
    const landed = Math.floor(reading / SEGMENT_ANGLE) % SEGMENT_COUNT;
    check(`seg ${seg} lands correctly (start ${start.toFixed(1)})`, landed === seg);
    check(`seg ${seg} had >= 5 extra full turns`, nextRotation - start >= 5 * 360);
  }
}

// 3) With random jitter the final reading stays inside the segment bounds,
//    and never straddles an edge (>= 15° from both boundaries).
for (let seg = 0; seg < 3; seg++) {
  for (let r = 0; r < 600; r++) {
    const start = Math.random() * 720;
    const { nextRotation } = computeWheelTarget(start, seg, 5);
    const reading = pointerAngle(nextRotation);
    check(`seg ${seg} reading inside bounds`, reading >= seg * SEGMENT_ANGLE && reading < (seg + 1) * SEGMENT_ANGLE);
    const fromStart = reading - seg * SEGMENT_ANGLE;
    const fromEnd = (seg + 1) * SEGMENT_ANGLE - reading;
    check(`seg ${seg} clear of edges`, fromStart >= 15 && fromEnd >= 15);
  }
}

// 4) pointerAngle always returns a value in [0, 360).
for (let r = 0; r < 2000; r++) {
  const a = pointerAngle((Math.random() - 0.5) * 1e7);
  check("pointerAngle bounds", a >= 0 && a < 360);
}

// 5) segmentUnderPointer matches pointerAngle at extremes.
{
  check("segmentUnderPointer 0", segmentUnderPointer(0) === 0);
  check("segmentUnderPointer 359.9", segmentUnderPointer(359.9) === 2);
  check("segmentUnderPointer 120", segmentUnderPointer(120) === 1);
}

console.log(failures === 0 ? "\n✅ ALL WHEEL TESTS PASSED" : `\n❌ ${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);