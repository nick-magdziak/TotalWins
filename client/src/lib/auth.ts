import { apiRequest } from "./queryClient";
import { type User } from "@shared/schema";

export interface AuthUser extends Omit<User, 'password'> {}

const AUTH_STORAGE_KEY = "total_wins_user";

// Initialize from localStorage
let currentUser: AuthUser | null = null;

// Initialize currentUser from localStorage on module load
try {
  const stored = localStorage.getItem(AUTH_STORAGE_KEY);
  if (stored) {
    currentUser = JSON.parse(stored);
    // Refresh user data from server in the background to pick up any changes (e.g. isAdmin flag)
    if (currentUser?.id) {
      fetch(`/api/auth/me/${currentUser.id}`)
        .then(r => r.ok ? r.json() : null)
        .then(freshUser => {
          if (freshUser) {
            currentUser = freshUser;
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(freshUser));
            window.dispatchEvent(new CustomEvent('authStateChanged'));
          }
        })
        .catch(() => {}); // silently ignore if offline
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

export async function login(email: string, password: string): Promise<AuthUser> {
  const response = await apiRequest("POST", "/api/auth/login", { email, password });
  const data = await response.json();
  setCurrentUser(data.user);
  return data.user;
}

export function logout(): void {
  setCurrentUser(null);
}

export function getCurrentUser(): AuthUser | null {
  return currentUser;
}

export function isAdmin(): boolean {
  return currentUser?.isAdmin ?? false;
}
