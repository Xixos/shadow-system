export default function RiskBadge({ v }: { v: number }) {
  const color =
    v >= 0.6 ? "bg-red-500/20 text-red-300 border-red-500/40" :
    v >= 0.3 ? "bg-amber-500/20 text-amber-200 border-amber-500/40" :
               "bg-emerald-500/20 text-emerald-200 border-emerald-500/40";
  return (
    <span className={`px-1.5 py-[2px] rounded border text-[11px] leading-none ${color}`}>
      {v.toFixed(2)}
    </span>
  );
}