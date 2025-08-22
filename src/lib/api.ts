import axios from "axios";
export const API = axios.create({ baseURL: "http://localhost:8000" });

export type User = {
  id: number; email: string; streak_days: number; last_seen: string;
  current_rank: number; activity_score: number; churn_risk: number;
};

export type Insights = {
  events: { login: number; view: number; share: number; purchase: number };
  churn_risk_top: User[];
};