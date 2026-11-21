import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

export function useAuth(options?: { redirectOnUnauthenticated?: boolean; redirectPath?: string }) {
  const queryClient = useQueryClient();
  const me = trpc.auth.me.useQuery(undefined, { retry: false, staleTime: 0, refetchOnWindowFocus: true, refetchInterval: 60_000 });
  const mutation = trpc.auth.logout.useMutation();
  const logout = async () => {
    await mutation.mutateAsync();
    queryClient.clear();
    window.location.assign("/login");
  };
  useEffect(() => {
    if (options?.redirectOnUnauthenticated && !me.isLoading && !me.data) {
      if (options.redirectPath) window.location.assign(options.redirectPath);
      else startLogin();
    }
  }, [options?.redirectOnUnauthenticated, options?.redirectPath, me.isLoading, me.data]);
  return { user: me.data ?? null, loading: me.isLoading, error: me.error, isAuthenticated: Boolean(me.data), refresh: me.refetch, logout };
}
