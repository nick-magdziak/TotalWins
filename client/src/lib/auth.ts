import { apiRequest } from "./queryClient";
import { type User } from "@shared/schema";

export interface AuthUser extends Omit<User, 'password'> {}

let currentUser: AuthUser | null = null;

export async function signup(userData: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  displayName: string;
}): Promise<AuthUser> {
  const response = await apiRequest("POST", "/api/auth/signup", userData);
  const data = await response.json();
  currentUser = data.user;
  return data.user;
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const response = await apiRequest("POST", "/api/auth/login", { email, password });
  const data = await response.json();
  currentUser = data.user;
  return data.user;
}

export function logout(): void {
  currentUser = null;
}

export function getCurrentUser(): AuthUser | null {
  return currentUser;
}

export function isAdmin(): boolean {
  return currentUser?.isAdmin ?? false;
}
