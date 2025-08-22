"use client";
import { useEffect, useState } from "react";
export default function CountUp({ to, dur=400 }: { to: number; dur?: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const start = performance.now(), from = 0;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      setV(Math.round(from + (to - from) * (0.5 - Math.cos(Math.PI*p)/2))); // ease
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, dur]);
  return <b>{v.toLocaleString()}</b>;
}