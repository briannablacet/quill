// v2 — calls shared pipeline module directly
import { NextRequest, NextResponse } from "next/server"
import { runJobPipeline } from "./pipeline"

export const maxDuration = 300

export async function POST(_req: NextRequest) {
  try {
    const result = await runJobPipeline()
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    )
  }
}
