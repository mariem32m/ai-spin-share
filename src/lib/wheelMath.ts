/**
 * Pure wheel mathematics — kept free of DOM so it can be unit-tested.
 *
 * Convention:
 * - The pointer sits at the TOP of the wheel (visual angle 0°).
 * - Segment `i` occupies the angular span [i*120°, (i+1)*120°).
 * - The wheel element rotates by `rotation` degrees (CSS clockwise).
 * - The pointer reading is the clockwise angle from the top of the wheel,
 *   which is exactly `rotation mod 360`: rotating the wheel 90° puts the
 *   material that was 90° clockwise from the top under the pointer. A
 *   reading of `r` means we are inside segment `floor(r / 120)`.
 */

export const SEGMENT_ANGLE = 120;
export const SEGMENT_COUNT = 360 / SEGMENT_ANGLE;

/**
 * Maximum random offset from a segment's centre. Kept well under half a
 * segment (±40° of the available ±60°) so the pointer always lands
 * clearly INSIDE the winning colour, never straddling a boundary.
 */
export const LANDING_JITTER = SEGMENT_ANGLE / 2 - 20;

/** Degrees clockwise from top currently under the pointer. */
export function pointerAngle(rotation: number): number {
  return ((rotation % 360) + 360) % 360;
}

/** Which segment (0..2) is currently under the pointer. */
export function segmentUnderPointer(rotation: number): number {
  return Math.floor(pointerAngle(rotation) / SEGMENT_ANGLE) % SEGMENT_COUNT;
}

/**
 * Compute the next absolute rotation so the wheel lands on `segment`.
 * The final reading stays inside the segment's span (with a random jitter
 * up to ±45° away from the segment centre, keeping it inside its bounds).
 */
export function computeWheelTarget(
  currentRotation: number,
  segment: number,
  extraSpins: number,
  random: () => number = Math.random,
): { nextRotation: number; targetReading: number } {
  const targetReading = segment * SEGMENT_ANGLE + SEGMENT_ANGLE / 2 + (random() * 2 - 1) * LANDING_JITTER;
  const currentReading = pointerAngle(currentRotation);
  let delta = (targetReading - currentReading) % 360;
  if (delta < 0) delta += 360;
  const nextRotation = currentRotation + extraSpins * 360 + delta;
  return { nextRotation, targetReading: ((targetReading % 360) + 360) % 360 };
}

/** Pick a uniform random segment index. */
export function randomSegment(random: () => number = Math.random): number {
  return Math.floor(random() * SEGMENT_COUNT);
}