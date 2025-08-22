import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { API, User, Insights } from "./api";

export function useUsers(enableAuto = true) {
  return useQuery<User[]>({
    queryKey: ["users"],
    queryFn: async () => (await API.get("/users")).data,
    staleTime: 10_000,
    refetchOnWindowFocus: false,
    refetchInterval: enableAuto ? 15_000 : false,
  });
}
export function useInsights(enableAuto = true) {
  return useQuery<Insights>({
    queryKey: ["insights"],
    queryFn: async () => (await API.get("/insights")).data,
    staleTime: 10_000,
    refetchOnWindowFocus: false,
    refetchInterval: enableAuto ? 15_000 : false,
  });
}

export function useSeed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => (await API.post("/seed")).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["insights"] });
    },
  });
}



export function useRescore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: number) => (await API.post(`/score/${userId}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["insights"] });
    },
  });
}

