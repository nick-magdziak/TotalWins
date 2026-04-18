import { useEffect, useState } from "react";
import { AUTH_STORAGE_KEY, type AuthUser } from "@/lib/auth";

function readUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

// Subscribes to localStorage / authStateChanged so components re-render
// the moment a user logs in, logs out, or completes verification.
export function useCurrentUserState(): AuthUser | null {
  const [user, setUser] = useState<AuthUser | null>(() => readUser());
  useEffect(() => {
    const handler = () => setUser(readUser());
    window.addEventListener("authStateChanged", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("authStateChanged", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);
  return user;
}

export function useIsVerified(): boolean {
  const user = useCurrentUserState();
  return !!user?.verifiedAt;
}
