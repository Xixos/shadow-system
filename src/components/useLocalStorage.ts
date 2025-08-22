import { useEffect, useState } from "react";
export default function useLocalStorage<T>(key: string, init: T) {
  const [v, setV] = useState<T>(() => {
    try { const j = localStorage.getItem(key); return j ? JSON.parse(j) : init; } catch { return init; }
  });
  useEffect(()=>{ try{ localStorage.setItem(key, JSON.stringify(v)); }catch{} }, [key,v]);
  return [v, setV] as const;
}