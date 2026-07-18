import { auth } from "@/lib/auth"
import { headers } from "next/headers"

// Single-user personal tool (migration.md §6 decision #1) — no multi-tenancy.
// better-auth needs a real DATABASE_URL that isn't configured in local dev,
// so outside production this resolves to a fixed dev user instead of
// forcing a real Postgres connection just to view the UI.
const DEV_USER_ID = "dev-test-user"

export async function getUserId(): Promise<string | null> {
  if (process.env.NODE_ENV !== "production") {
    return DEV_USER_ID
  }
  const session = await auth.api.getSession({ headers: await headers() })
  return session?.user?.id ?? null
}
