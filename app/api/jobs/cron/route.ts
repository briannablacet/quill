/**
 * GET /api/jobs/cron
 *
 * Called by Vercel Cron at 7:00 AM UTC daily.
 * Validates the CRON_SECRET header then delegates to the pipeline route.
 */

import { NextRequest, NextResponse } from "next/server"

export const maxDuration = 300

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get("authorization")
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  // Delegate to the run route — POST to itself
  const base = req.nextUrl.origin
  const res = await fetch(`${base}/api/jobs/run`, { method: "POST" })
  const data = await res.json()
  return NextResponse.json({ cron: true, ...data }, { status: res.status })
}
