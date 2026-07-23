/**
 * Region count equals grid size (5-10). Hues are placed with the golden
 * angle instead of an even 36-degree split: an even split puts regions
 * 0-4 (the common low-region-count grids) all within a 144-degree arc,
 * bunching yellow/green/turquoise together. The golden angle keeps every
 * prefix of the sequence - not just the full set of 10 - spread around the
 * wheel. Lightness alternates per region as a second cue for whichever
 * hues still land close together. Colorblind patterning is out of scope
 * for v1 (§9) - colors alone distinguish regions.
 */
const GOLDEN_ANGLE = 137.508;

function hueFor(regionId: number): number {
  return (regionId * GOLDEN_ANGLE) % 360;
}

export function regionColorLight(regionId: number): string {
  const h = hueFor(regionId);
  const l = regionId % 2 === 0 ? 78 : 69;
  return `hsl(${h}, 88%, ${l}%)`;
}

export function regionColorDark(regionId: number): string {
  const h = hueFor(regionId);
  const l = regionId % 2 === 0 ? 44 : 35;
  return `hsl(${h}, 62%, ${l}%)`;
}
