/** `rotation` is volunteer ids in poster order. */
export function nextPoster(rotation: number[], previousPosterId: number | null): number | null {
  if (rotation.length === 0) return null;
  const i = previousPosterId === null ? -1 : rotation.indexOf(previousPosterId);
  return i === -1 ? rotation[0] : rotation[(i + 1) % rotation.length];
}
