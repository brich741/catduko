/**
 * 10 hand-picked pastel hues (evenly spaced around the wheel), sized for the
 * largest grid (Expert, 10 regions). Colorblind patterning is out of scope
 * for v1 (§9) - colors alone distinguish regions, so hues are spaced for
 * maximum distinguishability at pastel saturation/lightness.
 */
const HUES = [0, 36, 72, 108, 144, 180, 216, 252, 288, 324];

export function regionColorLight(regionId: number): string {
  const h = HUES[regionId % HUES.length];
  return `hsl(${h}, 68%, 86%)`;
}

export function regionColorDark(regionId: number): string {
  const h = HUES[regionId % HUES.length];
  return `hsl(${h}, 32%, 28%)`;
}
