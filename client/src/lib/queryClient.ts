import { QueryClient, QueryFunction } from "@tanstack/react-query";

const AUTH_STORAGE_KEY = "total_wins_user";

function handleSessionExpired() {
  // Clear stale local auth so the user is redirected to sign-in
  localStorage.removeItem(AUTH_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent("authStateChanged"));
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    // 401 = Not authenticated — session is gone or was never established.
    // Sign out locally so the user is redirected to the login screen rather
    // than seeing a broken "No leagues found" state.
    if (res.status === 401) {
      const hasStoredUser = !!localStorage.getItem(AUTH_STORAGE_KEY);
      if (hasStoredUser) {
        handleSessionExpired();
      }
    }
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
