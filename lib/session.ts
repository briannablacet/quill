import { auth } from "@/lib/auth"
import { headers } from "next/headers"

// Single-user personal tool (migration.md §6 decision #1) — no multi-tenancy.
// better-auth needs a real DATABASE_URL that isn't configured yet (local dev
// or production), so this resolves to a fixed dev user instead of forcing a
// real Postgres connection just to view the UI.
const DEV_USER_ID = "dev-test-user"

// DEMO_MODE is a deliberate, temporary override to let the deployed site be
// shown to people before real Postgres-backed auth is wired up (2026-07-19).
// Remove this flag (unset it in Vercel) once DATABASE_URL is configured and
// real sign-in should be enforced in production.
export async function getUserId(): Promise<string | null> {
  if (process.env.NODE_ENV !== "production" || process.env.DEMO_MODE === "true") {
    return DEV_USER_ID
  }
  const session = await auth.api.getSession({ headers: await headers() })
  return session?.user?.id ?? null
}
