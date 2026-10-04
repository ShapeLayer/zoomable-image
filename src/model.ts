/** Image-relative percentage coordinates, independent of zoom and display size. */
export interface ImageAnnotation {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  tooltip?: string;
}
export const zoomLevels = [0.5, 0.75, 1, 1.5, 2, 3, 4] as const;
export function validAnnotation(value: unknown): value is ImageAnnotation {
  if (!value || typeof value !== 'object') return false;
  const a = value as ImageAnnotation;
  return (
    typeof a.id === 'string' &&
    typeof a.text === 'string' &&
    (a.tooltip === undefined || typeof a.tooltip === 'string') &&
    [a.x, a.y, a.width, a.height].every(Number.isFinite) &&
    a.x >= 0 &&
    a.y >= 0 &&
    a.width > 0 &&
    a.height > 0 &&
    a.x + a.width <= 100 &&
    a.y + a.height <= 100
  );
}
export function clampPan(
  x: number,
  y: number,
  width: number,
  height: number,
  scale: number,
  viewportWidth: number,
  viewportHeight: number
) {
  const maxX = Math.max(0, (width * scale - viewportWidth) / 2);
  const maxY = Math.max(0, (height * scale - viewportHeight) / 2);
  return { x: Math.min(maxX, Math.max(-maxX, x)), y: Math.min(maxY, Math.max(-maxY, y)) };
}
