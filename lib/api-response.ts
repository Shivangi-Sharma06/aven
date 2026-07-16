import { NextResponse } from "next/server";

export function apiError(error: unknown, status = 400) {
  return NextResponse.json(
    { error: error instanceof Error ? error.message : String(error) },
    { status },
  );
}
