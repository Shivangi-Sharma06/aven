import { NextResponse } from "next/server";

export function apiError(error: unknown, status?: number) {
  const errorStatus =
    typeof error === "object" &&
    error !== null &&
    "httpStatus" in error &&
    typeof error.httpStatus === "number"
      ? error.httpStatus
      : undefined;
  return NextResponse.json(
    { error: error instanceof Error ? error.message : String(error) },
    { status: status ?? errorStatus ?? 400 },
  );
}
