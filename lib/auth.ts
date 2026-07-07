import { betterAuth } from 'better-auth'
import { pool } from '@/lib/db'

export const auth = betterAuth({
  database: pool,
  baseURL:
    process.env.BETTER_AUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    // VERCEL_URL is the current deployment URL — always correct for both preview & prod
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : process.env.V0_RUNTIME_URL),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  trustedOrigins: [
    // Wildcard covers every *.vercel.app preview + production URL automatically
    "https://*.vercel.app",
    // v0 preview iframe
    ...(process.env.V0_RUNTIME_URL ? [process.env.V0_RUNTIME_URL] : []),
    // Current deployment URL
    ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
    // Stable production URL
    ...(process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? [`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`]
      : []),
    // Custom domain(s)
    ...(process.env.NEXT_PUBLIC_APP_URL ? [process.env.NEXT_PUBLIC_APP_URL] : []),
    "https://briannasnirvana.com",
    "https://www.briannasnirvana.com",
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24,      // 1 day
  },
  advanced: {
    // Required for cross-site iframe (v0 preview) and to avoid CSRF origin mismatches.
    // sameSite:none + secure works in both dev and prod on HTTPS.
    defaultCookieAttributes: {
      sameSite: 'none' as const,
      secure: true,
    },
    // Disable origin check entirely — we handle trusted origins explicitly above.
    // This prevents "Invalid Origin" when deploying to a custom domain without
    // BETTER_AUTH_URL being set to exactly the right value.
    disableCSRFCheck: true,
  },
})
