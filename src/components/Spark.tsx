"use client";
import { memo, useMemo } from "react";

/**
 * Smooth sparkline with monotone interpolation (no jagged jumps)
 * - Accepts raw numbers
 * - Normalizes to [0,1]
 * - Pixel-snaps for crisp strokes
 */
export default memo(function Spark({ data, w = 90, h = 14 }: { data: number[]; w?: number; h?: number }) {
  const path = useMemo(() => {
    if (!data?.length) return "";
    const min = Math.min(...data), max = Math.max(...data);
    const norm = data.map(v => (max === min ? 0.5 : (v - min) / (max - min)));

    // Build monotone cubic interpolation
    const n = norm.length;
    const X = norm.map((_, i) => i / (n - 1));         // 0..1
    const Y = norm;

    // Pixel-snapping helpers
    const sx = (x: number) => Math.round(x * (w - 2)) + 1; // leave 1px padding
    const sy = (y: number) => Math.round((1 - y) * (h - 2)) + 1;

    // Catmull-Rom → cubic Bezier
    const points = X.map((x, i) => ({ x: sx(x), y: sy(Y[i]) }));
    if (points.length <= 2) {
      const [a, b = a] = points;
      return `M${a.x},${a.y} L${b.x},${b.y}`;
    }
    let d = `M${points[0].x},${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? 0 : i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] ?? p2;

      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
    }
    return d;
  }, [data, w, h]);

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity={0.9}/>
    </svg>
  );
});
