import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// This check can be removed, it is just for tutorial purposes
export const hasEnvVars =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// Dev-only escape hatch: set NEXT_PUBLIC_DEV_BYPASS_AUTH=true in .env.local
// to skip the login flow when there's no real Supabase project configured.
// Never enable this in production.
export const bypassAuth = process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === "true";
