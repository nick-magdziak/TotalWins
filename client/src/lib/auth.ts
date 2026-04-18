import { apiRequest } from "./queryClient";
import { type User } from "@shared/schema";

export interface AuthUser extends Omit<User, 'password'> {}

export const AUTH_STORAGE_KEY = "total_wins_user";

// Initialize from localStorage
let currentUser: AuthUser | null = null;

// Initialize currentUser from localStorage on module load
try {
  const stored = localStorage.getItem(AUTH_STORAGE_KEY);
  if (stored) {
    currentUser = JSON.parse(stored);
    // Verify the session is still valid with the server.
    // If the server returns 401/403 (e.g. session expired after restart), clear local state.
    if (currentUser?.id) {
      const validatingId = currentUser.id; // capture to detect race conditions
      fetch(`/api/auth/me/${validatingId}`)
        .then(r => {
          // If the user changed while this request was in-flight (e.g. the user
          // logged in as someone else), ignore the result entirely — acting on
          // a stale 403 would incorrectly log out the newly-authenticated user.
          if (!currentUser || currentUser.id !== validatingId) return null;
          if (r.status === 401 || r.status === 403) {
            // Session is gone — clear localStorage so the user is prompted to log in again
            currentUser = null;
            localStorage.removeItem(AUTH_STORAGE_KEY);
            window.dispatchEvent(new CustomEvent('authStateChanged'));
            return null;
          }
          return r.ok ? r.json() : null;
        })
        .then(freshUser => {
          if (freshUser) {
            currentUser = freshUser;
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(freshUser));
            window.dispatchEvent(new CustomEvent('authStateChanged'));
          }
        })
        .catch(() => {}); // silently ignore if offline/network error
    }
  }
} catch (error) {
  console.warn("Failed to load user from localStorage:", error);
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

export function setCurrentUser(user: AuthUser | null): void {
  currentUser = user;
  if (user) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }
  // Dispatch custom event to notify auth state change
  window.dispatchEvent(new CustomEvent('authStateChanged'));
}

export async function signup(userData: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  displayName: string;
  inviteCode?: string;
}): Promise<{ user: AuthUser; joinedLeagueId: string | null; joinWarning: string | null }> {
  const response = await apiRequest("POST", "/api/auth/signup", userData);
  const data = await response.json();
  setCurrentUser(data.user);
  return { user: data.user, joinedLeagueId: data.joinedLeagueId ?? null, joinWarning: data.joinWarning ?? null };
}

export async function login(email: string, password: string, rememberMe = false): Promise<AuthUser> {
  const response = await apiRequest("POST", "/api/auth/login", { email, password, rememberMe });
  const data = await response.json();
  setCurrentUser(data.user);
  return data.user;
}

export function logout(): void {
  setCurrentUser(null);
  // Destroy the server-side session so the auth cookie can't be reused
  fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
}

export function getCurrentUser(): AuthUser | null {
  return currentUser;
}

export function isAdmin(): boolean {
  return currentUser?.isAdmin ?? false;
}
