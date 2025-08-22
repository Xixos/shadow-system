"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { exportCsv } from "@/lib/exportCsv";

/* ---------------- Types ---------------- */
type MockUser = {
  id: number;
  email: string;
  current_rank: number;
  streak_days: number;
  activity_score: number;
  churn_risk: number;
};

type Insights = {
  events: {
    login: number;
    view: number;
    share: number;
    purchase: number;
  };
  churn_risk_top: MockUser[];
};

type SortKey = "risk" | "score" | "streak" | "rank";

/* ---------------- Env / API helpers ---------------- */
const API = process.env.NEXT_PUBLIC_API_URL; // e.g. http://127.0.0.1:8000

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

/* ---------------- Mock generators (for reseed) ---------------- */
function generateMockUsers(n = 100): MockUser[] {
  return Array.from({ length: n }, (_, i) => {
    const score = Math.floor(Math.random() * 1000);
    return {
      id: i + 1,
      email: `user${i + 1}@example.com`,
      current_rank: Math.floor(Math.random() * 100) + 1,
      streak_days: Math.floor(Math.random() * 365),
      activity_score: score,
      churn_risk: Math.min(
        0.99,
        Math.max(
          0.01,
          1 - Math.tanh(score / 1200) + (Math.random() - 0.5) * 0.2
        )
      ),
    };
  });
}

function generateMockInsights(users: MockUser[]): Insights {
  const totalScore = users.reduce((a, u) => a + u.activity_score, 0);
  const login = Math.floor(totalScore * 0.09) + 8_000 + Math.floor(Math.random() * 3_000);
  const view = Math.floor(totalScore * 0.25) + 25_000 + Math.floor(Math.random() * 12_000);
  const share = Math.floor(totalScore * 0.05) + 5_000 + Math.floor(Math.random() * 5_000);
  const purchase = Math.floor(totalScore * 0.03) + 3_000 + Math.floor(Math.random() * 3_000);
  const churn_risk_top = [...users]
    .sort((a, b) => b.churn_risk - a.churn_risk)
    .slice(0, 10);
  return { events: { login, view, share, purchase }, churn_risk_top };
}

/* ---------------- Small UI atoms ---------------- */
const CountUp = React.memo(function CountUp({
  value,
  duration = 1000,
}: {
  value: number;
  duration?: number;
}) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let start = 0;
    const end = parseInt(String(value));
    const incrementTime = (duration / Math.max(end, 1)) * 2;
    const timer = setInterval(() => {
      start += Math.ceil(Math.max(end, 1) / 50);
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else setCount(start);
    }, incrementTime);
    return () => clearInterval(timer);
  }, [value, duration]);
  return <span className="tabular-nums">{count.toLocaleString()}</span>;
});

const RiskBadge = React.memo(function RiskBadge({ v }: { v: number }) {
  const level = v < 0.3 ? "low" : v < 0.7 ? "medium" : "high";
  const colors: Record<string, string> = {
    low: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    high: "bg-red-500/20 text-red-400 border-red-500/30",
  };
  return (
    <motion.span
      className={`px-1.5 py-0.5 rounded-full text-[10px] border ${colors[level]}`}
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
    >
      {(v * 100).toFixed(0)}%
    </motion.span>
  );
});

const Spark = React.memo(function Spark({ data }: { data: number[] }) {
  const max = Math.max(...data);
  const points = data.map((d, i) => `${i * 3},${20 - (d / max) * 15}`).join(" ");
  return (
    <motion.svg
      width="21"
      height="20"
      className="inline-block"
      initial={{ pathLength: 0 }}
      animate={{ pathLength: 1 }}
      transition={{ duration: 1, ease: "easeInOut" }}
    >
      <motion.polyline
        fill="none"
        stroke="#10b981"
        strokeWidth="1"
        points={points}
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.2 }}
      />
    </motion.svg>
  );
});

/* -------- Hydration-safe floating particles (computed after mount) -------- */
type Particle = { x: number; y: number; dur: number };
const FloatingParticles = ({ pts }: { pts: Particle[] }) => (
  <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
    {pts.map((p, i) => (
      <motion.div
        key={i}
        className="absolute w-1 h-1 bg-emerald-400/20 rounded-full"
        initial={{ x: p.x, y: p.y }}
        animate={{
          x: typeof window !== "undefined" ? Math.random() * window.innerWidth : p.x,
          y: typeof window !== "undefined" ? Math.random() * window.innerHeight : p.y,
        }}
        transition={{ duration: p.dur, repeat: Infinity, ease: "linear" }}
      />
    ))}
  </div>
);

/* -------- Chart (calibrated bars using % of total) -------- */
const GlowingChart = ({ insights }: { insights: Insights }) => {
  const chartData = [
    { label: "Login", value: insights.events.login || 0, color: "#60a5fa" },
    { label: "View", value: insights.events.view || 0, color: "#34d399" },
    { label: "Share", value: insights.events.share || 0, color: "#fbbf24" },
    { label: "Purchase", value: insights.events.purchase || 0, color: "#f472b6" },
  ];
  const total = chartData.reduce((a, d) => a + d.value, 0) || 1;

  return (
    <div className="relative">
      <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-blue-500/10 to-purple-500/10 rounded-xl blur-xl"></div>
      <div className="relative bg-[#0a0f14]/90 backdrop-blur-sm rounded-xl p-6 border border-zinc-800/50">
        <motion.h3
          className="text-lg font-semibold mb-4 bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          Growth Analytics
        </motion.h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {chartData.map((item, i) => {
            const pct = (item.value / total) * 100;
            const widthPct = Math.max(6, pct); // min bar length
            return (
              <motion.div
                key={item.label}
                className="relative group"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                whileHover={{ scale: 1.05 }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-white/0 rounded-lg blur-sm group-hover:blur-none transition-all duration-300"></div>
                <div className="relative p-4 rounded-lg bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 transition-all duration-300">
                  <div className="text-xs text-zinc-400 mb-1">{item.label}</div>
                  <div className="text-2xl font-bold" style={{ color: item.color }}>
                    <CountUp value={item.value} />
                  </div>
                  <motion.div
                    className="mt-2 h-1 bg-zinc-800 rounded-full overflow-hidden"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ delay: i * 0.1 + 0.5, duration: 0.8 }}
                  >
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: item.color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${widthPct}%` }}
                      transition={{ delay: i * 0.1 + 0.7, duration: 1, ease: "easeOut" }}
                    />
                  </motion.div>
                  <div className="mt-1 text-[10px] text-zinc-400">{pct.toFixed(1)}%</div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/* ---------------- Page ---------------- */
export default function EnhancedDashboard() {
  // deterministic initial SSR state
  const [users, setUsers] = useState<MockUser[]>([]);
  const [insights, setInsights] = useState<Insights>({
    events: { login: 0, view: 0, share: 0, purchase: 0 },
    churn_risk_top: [],
  });
  const [dataSource, setDataSource] = useState<"DEMO" | "API">("DEMO");

  // UI state
  const [now, setNow] = useState("");
  const [qRaw, setQRaw] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("risk");
  const [selected, setSelected] = useState<MockUser | null>(null);
  const [auto, setAuto] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [rescoringId, setRescoringId] = useState<number | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // particles (hydration-safe)
  const [mounted, setMounted] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  useEffect(() => {
    setMounted(true);
    const W = typeof window !== "undefined" ? window.innerWidth : 1920;
    const H = typeof window !== "undefined" ? window.innerHeight : 1080;
    setParticles(
      Array.from({ length: 20 }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        dur: Math.random() * 20 + 10,
      }))
    );
  }, []);

  // clock
  useEffect(() => {
    const tick = () => setNow(new Date().toLocaleTimeString());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // debounce search
  useEffect(() => {
    const id = setTimeout(() => setQ(qRaw), 150);
    return () => clearTimeout(id);
  }, [qRaw]);

  // data load after mount
  const loadData = useCallback(async () => {
    if (API) {
      try {
        const [u, i] = await Promise.all([
          fetchJSON<MockUser[]>(`${API}/users`),
          fetchJSON<Insights>(`${API}/insights`),
        ]);
        if (Array.isArray(u) && u.length) setUsers(u);
        if (i?.events) setInsights(i);
        setDataSource("API");
        return;
      } catch {
        setDataSource("DEMO");
      }
    }
    // demo fallback
    const freshUsers = generateMockUsers();
    setUsers(freshUsers);
    setInsights(generateMockInsights(freshUsers));
    setDataSource("DEMO");
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // derived list
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const M: Record<SortKey, keyof MockUser> = {
      rank: "current_rank",
      streak: "streak_days",
      score: "activity_score",
      risk: "churn_risk",
    };
    const k = M[sort];
    return [...users]
      .filter((u) => !needle || u.email.toLowerCase().includes(needle))
      .sort((a, b) => (b[k] as number) - (a[k] as number))
      .slice(0, 50);
  }, [users, q, sort]);

  // keyboard shortcuts
  const handleSeed = useCallback(async () => {
    setIsSeeding(true);
    try {
      if (API) {
        await fetch(`${API}/seed`, { method: "POST" });
        await loadData();
        setDataSource("API");
      } else {
        const freshUsers = generateMockUsers();
        setUsers(freshUsers);
        setInsights(generateMockInsights(freshUsers));
        setDataSource("DEMO");
      }
    } finally {
      setIsSeeding(false);
      setSelected(null);
      setQRaw("");
    }
  }, [loadData]);

  const handleRescore = useCallback(
    async (user: MockUser) => {
      setRescoringId(user.id);
      try {
        if (API) {
          const updated = await fetchJSON<MockUser>(
            `${API}/users/${user.id}/rescore`,
            { method: "POST" }
          );
          setUsers((prev) => {
            const next = prev.map((u) => (u.id === user.id ? updated : u));
            setInsights(generateMockInsights(next));
            if (selected?.id === user.id) {
              setSelected(next.find((u) => u.id === user.id) || null);
            }
            return next;
          });
        } else {
          // Demo update
          const factor = 1 + (Math.random() * 0.3 - 0.15);
          const updated: MockUser = {
            ...user,
            activity_score: Math.max(0, Math.round(user.activity_score * factor)),
            streak_days:
              Math.random() < 0.4 ? user.streak_days + 1 : Math.max(0, user.streak_days - 1),
            current_rank: Math.max(
              1,
              Math.min(100, user.current_rank + Math.round(Math.random() * 10 - 5))
            ),
            churn_risk: Math.min(
              0.99,
              Math.max(
                0.01,
                1 -
                  Math.tanh(Math.max(0, Math.round(user.activity_score * factor)) / 1200) +
                  (Math.random() - 0.5) * 0.18
              )
            ),
          };
          setUsers((prev) => {
            const next = prev.map((u) => (u.id === user.id ? updated : u));
            setInsights(generateMockInsights(next));
            if (selected?.id === user.id) {
              setSelected(next.find((u) => u.id === user.id) || null);
            }
            return next;
          });
        }
      } finally {
        setRescoringId(null);
      }
    },
    [selected]
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "/" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape") setSelected(null);
      if (e.key.toLowerCase() === "a") setAuto((a) => !a);
      if (e.key === "1") setSort("risk");
      if (e.key === "2") setSort("score");
      if (e.key === "3") setSort("streak");
      if (e.key === "4") setSort("rank");
      if (e.key.toLowerCase() === "s") handleSeed();
      if (e.key.toLowerCase() === "c")
        exportCsv(
          filtered,
          ["email", "current_rank", "streak_days", "activity_score", "churn_risk"],
          "users.csv"
        );
      if (e.key.toLowerCase() === "r" && selected) handleRescore(selected);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtered, selected, handleSeed, handleRescore]);

  // CSV export (button handler)
  const onDownloadCsv = useCallback(() => {
    exportCsv(
      filtered,
      ["email", "current_rank", "streak_days", "activity_score", "churn_risk"],
      "users.csv"
    );
  }, [filtered]);

  // tiny spark series
  const sampleTrend = (u: MockUser) => {
    const base = Math.max(5, u.activity_score);
    const out: number[] = [];
    for (let i = 0; i < 7; i++) {
      const slope = 1 + (i - 3) * 0.018;
      const wiggle = 1 + Math.sin(i * 1.3) * 0.015;
      out.push(Math.round(base * slope * wiggle));
    }
    return out;
  };

  // typed totals
  const totalEvents = (Object.values(insights.events) as number[]).reduce(
    (a, b) => a + b,
    0
  );
  const avgRisk = users.length
    ? (users.reduce((a, u) => a + u.churn_risk, 0) / users.length).toFixed(2)
    : "—";

  return (
    <div className="min-h-screen bg-[#0b0f13] relative">
      {mounted && <FloatingParticles pts={particles} />}

      {/* Animated Background Grid */}
      <div className="fixed inset-0 opacity-10 z-0">
        <svg className="w-full h-full">
          <defs>
            <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
              <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#10b981" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      <main className="relative z-10 mx-auto max-w-7xl p-6 space-y-6">
        {/* Header */}
        <motion.header
          className="sticky top-0 z-20 bg-[#0b0f13]/95 backdrop-blur-xl border-b border-zinc-800/50 -mx-6 px-6 py-4"
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <div className="flex items-center justify-between mb-4">
            <motion.div
              className="flex items-center gap-3"
              whileHover={{ scale: 1.02 }}
              transition={{ type: "spring", stiffness: 400 }}
            >
              <motion.div
                className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-blue-500 flex items-center justify-center"
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                role="img"
                aria-label="Shadow System logo"
              >
                ⚡
              </motion.div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                  Shadow System
                </h1>
                <p className="text-xs text-zinc-400">AI + Growth Intelligence</p>
              </div>
            </motion.div>

            <motion.div
              className="flex items-center gap-3 text-xs text-zinc-400"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <span aria-live="polite" role="status" className="hidden sm:inline">
                Updated {now}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full border ${
                  dataSource === "API"
                    ? "text-emerald-400 border-emerald-500/40 bg-emerald-500/10"
                    : "text-zinc-300 border-zinc-600 bg-zinc-700/20"
                }`}
                title={dataSource === "API" ? "Live from API" : "Demo data"}
              >
                {dataSource}
              </span>
              <motion.div
                className="w-2 h-2 bg-emerald-400 rounded-full"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </motion.div>
          </div>

          {/* Controls */}
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4">
            <div className="flex items-center gap-4">
              <motion.input
                ref={searchRef}
                id="search"
                placeholder="Search users... (/ to focus)"
                className="input w-64 bg-zinc-900/50 backdrop-blur border-zinc-700 focus:border-emerald-500 transition-all"
                onChange={(e) => setQRaw(e.target.value)}
                whileFocus={{ scale: 1.02 }}
                transition={{ type: "spring", stiffness: 400 }}
                aria-label="Search users"
              />
              <div className="flex items-center gap-4 text-xs border-l border-zinc-800 pl-4">
                <span className="flex items-center gap-1">
                  <span className="text-zinc-400">Users</span>
                  <motion.b
                    className="text-emerald-400"
                    key={users.length}
                    initial={{ scale: 1.2 }}
                    animate={{ scale: 1 }}
                  >
                    <CountUp value={users.length} duration={800} />
                  </motion.b>
                </span>
                <span className="opacity-40">•</span>
                <span className="flex items-center gap-1">
                  <span className="text-zinc-400">Events</span>
                  <motion.b
                    className="text-blue-400"
                    key={totalEvents}
                    initial={{ scale: 1.2 }}
                    animate={{ scale: 1 }}
                  >
                    <CountUp value={totalEvents} duration={1200} />
                  </motion.b>
                </span>
                <span className="opacity-40">•</span>
                <span className="flex items-center gap-1">
                  <span className="text-zinc-400">Risk</span>
                  <b className="text-purple-400">{avgRisk}</b>
                </span>
              </div>
            </div>

            <div />

            <div className="flex items-center gap-2">
              <motion.select
                className="input w-24 text-xs bg-zinc-900/50"
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                whileFocus={{ scale: 1.02 }}
                aria-label="Sort metric"
              >
                <option value="risk">Risk</option>
                <option value="score">Score</option>
                <option value="streak">Streak</option>
                <option value="rank">Rank</option>
              </motion.select>

              <label className="flex items-center gap-1 text-xs text-zinc-400 cursor-pointer">
                <motion.input
                  type="checkbox"
                  checked={auto}
                  onChange={(e) => setAuto(e.target.checked)}
                  whileHover={{ scale: 1.1 }}
                />
                Auto
              </label>

              <motion.button
                className="btn text-xs h-7 px-2 bg-zinc-800 hover:bg-zinc-700"
                onClick={handleSeed}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                disabled={isSeeding}
                aria-label="Seed data"
                title={API ? "POST /seed (API)" : "Regenerate demo dataset"}
              >
                {isSeeding ? "Seeding…" : "Seed"}
              </motion.button>

              <motion.button
                className="btn text-xs h-7 px-2 bg-emerald-600 hover:bg-emerald-500"
                onClick={onDownloadCsv}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                aria-label="Download CSV"
              >
                CSV
              </motion.button>
            </div>
          </div>
        </motion.header>

        {/* Chart */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <GlowingChart insights={insights} />
        </motion.div>

        {/* Table */}
        <motion.section
          className="relative overflow-hidden"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-zinc-900/50 to-zinc-800/30 backdrop-blur-sm rounded-xl"></div>
          <div className="relative border border-zinc-800/50 rounded-xl overflow-hidden">
            <div className="h-[60vh] overflow-auto custom-scrollbar">
              <table className="w-full text-xs table-fixed">
                <colgroup>
                  <col className="w-[260px]" />
                  <col className="w-[80px]" />
                  <col className="w-[80px]" />
                  <col className="w-[100px]" />
                  <col className="w-[90px]" />
                  <col />
                  <col className="w-[120px]" />
                </colgroup>
                <motion.thead
                  className="sticky top-0 bg-[#0a0f14]/95 backdrop-blur-sm border-b border-zinc-800 z-10"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                >
                  <tr className="text-zinc-400">
                    <th scope="col" className="text-left py-3 px-4 font-medium">
                      Email
                    </th>
                    <th scope="col" className="py-3 px-4 font-medium" aria-sort={sort === "rank" ? "descending" : "none"}>
                      Rank
                    </th>
                    <th scope="col" className="py-3 px-4 font-medium" aria-sort={sort === "streak" ? "descending" : "none"}>
                      Streak
                    </th>
                    <th scope="col" className="py-3 px-4 font-medium" aria-sort={sort === "score" ? "descending" : "none"}>
                      Score
                    </th>
                    <th scope="col" className="py-3 px-4 font-medium" aria-sort={sort === "risk" ? "descending" : "none"}>
                      Risk
                    </th>
                    <th scope="col" className="py-3 px-4 font-medium text-right">
                      Trend
                    </th>
                    <th scope="col" className="py-3 px-4 font-medium text-right">
                      Actions
                    </th>
                  </tr>
                </motion.thead>
                <tbody>
                  <AnimatePresence>
                    {filtered.map((u, index) => {
                      const isSelected = selected?.id === u.id;
                      const isRowBusy = rescoringId === u.id || isSeeding;
                      return (
                        <React.Fragment key={u.id}>
                          <motion.tr
                            className={`cursor-pointer transition-all duration-200 hover:bg-zinc-800/50 ${
                              isSelected ? "bg-zinc-800/70" : ""
                            } ${isRowBusy ? "opacity-70" : ""}`}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.02, duration: 0.3 }}
                            onClick={() => setSelected(isSelected ? null : u)}
                            whileHover={{ backgroundColor: "rgba(39,39,42,0.5)" }}
                          >
                            <td className="py-3 px-4 truncate">{u.email}</td>
                            <td className="py-3 px-4 text-center">
                              <motion.span
                                className="inline-block px-2 py-1 rounded bg-zinc-800 text-zinc-300"
                                whileHover={{ scale: 1.1 }}
                              >
                                {u.current_rank}
                              </motion.span>
                            </td>
                            <td className="py-3 px-4 text-center">{u.streak_days}</td>
                            <td className="py-3 px-4 text-center">
                              <motion.span
                                className="font-mono text-emerald-400"
                                initial={{ scale: 0.8 }}
                                animate={{ scale: 1 }}
                              >
                                {u.activity_score}
                              </motion.span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <RiskBadge v={u.churn_risk} />
                            </td>
                            <td className="py-3 px-4 text-right">
                              <Spark data={sampleTrend(u)} />
                            </td>
                            <td className="py-3 px-4 text-right">
                              <motion.button
                                className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs disabled:opacity-60"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRescore(u);
                                }}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                disabled={isRowBusy}
                              >
                                {rescoringId === u.id ? "…" : "Rescore"}
                              </motion.button>
                            </td>
                          </motion.tr>

                          <AnimatePresence>
                            {isSelected && (
                              <motion.tr
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.3 }}
                                className="bg-gradient-to-r from-zinc-900/50 to-zinc-800/30 border-t border-zinc-800"
                              >
                                <td colSpan={7} className="p-4">
                                  <motion.div
                                    className="flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                                    initial={{ y: -10, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: 0.1 }}
                                  >
                                    <div className="text-sm">
                                      <div className="font-semibold text-emerald-400 mb-1">
                                        {u.email}
                                      </div>
                                      <div className="text-zinc-300 flex items-center gap-4">
                                        <span>Rank {u.current_rank}</span>
                                        <span>Streak {u.streak_days} days</span>
                                        <span>Score {u.activity_score}</span>
                                        <span>
                                          Risk <RiskBadge v={u.churn_risk} />
                                        </span>
                                      </div>
                                    </div>
                                    <div className="text-xs text-zinc-400">
                                      <span className="mr-2">High Risk Users:</span>
                                      {insights.churn_risk_top.slice(0, 3).map((t: MockUser) => (
                                        <span key={t.id} className="mr-3">
                                          {t.email.split("@")[0]}{" "}
                                          <span className="ml-1">
                                            <RiskBadge v={t.churn_risk} />
                                          </span>
                                        </span>
                                      ))}
                                    </div>
                                  </motion.div>
                                </td>
                              </motion.tr>
                            )}
                          </AnimatePresence>
                        </React.Fragment>
                      );
                    })}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </div>
        </motion.section>

        {/* Footer (keyboard cheat-sheet) */}
        <motion.footer
          className="text-xs text-zinc-500 text-center py-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          <div className="flex flex-wrap items-center justify-center gap-4">
            <span>AI Intelligence: ACTIVE</span>
            <span className="opacity-40">•</span>
            <span>Keyboard:</span>
            <span>
              <kbd className="px-1 py-0.5 bg-zinc-800 rounded text-zinc-300">/</kbd> focus search
            </span>
            <span>
              <kbd className="px-1 py-0.5 bg-zinc-800 rounded text-zinc-300">Esc</kbd> clear
              selection
            </span>
            <span>
              <kbd className="px-1 py-0.5 bg-zinc-800 rounded text-zinc-300">A</kbd> toggle auto
            </span>
            <span>
              <kbd className="px-1 py-0.5 bg-zinc-800 rounded text-zinc-300">1</kbd>
              <kbd className="px-1 py-0.5 bg-zinc-800 rounded text-zinc-300">2</kbd>
              <kbd className="px-1 py-0.5 bg-zinc-800 rounded text-zinc-300">3</kbd>
              <kbd className="px-1 py-0.5 bg-zinc-800 rounded text-zinc-300">4</kbd> change sort
            </span>
            <span>
              <kbd className="px-1 py-0.5 bg-zinc-800 rounded text-zinc-300">S</kbd> seed{" "}
              {API ? "API" : "demo"} data
            </span>
            <span>
              <kbd className="px-1 py-0.5 bg-zinc-800 rounded text-zinc-300">C</kbd> export CSV
            </span>
            <span>
              <kbd className="px-1 py-0.5 bg-zinc-800 rounded text-zinc-300">R</kbd> rescore
              selected
            </span>
            <span className="bg-gradient-to-r from-emerald-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
              Shadow System • AI + Growth Intelligence • Demo (LLM Optional)
            </span>
          </div>
        </motion.footer>
      </main>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(39, 39, 42, 0.3);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(16, 185, 129, 0.5);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(16, 185, 129, 0.7);
        }
        kbd {
          font-family: ui-monospace, SFMono-Regular, monospace;
          font-size: 10px;
        }
      `}</style>
    </div>
  );
}
