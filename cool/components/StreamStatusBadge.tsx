import type { StreamStatus } from "@/lib/stellar";

const labels: Record<StreamStatus, string> = {
  active: "● ACTIVE",
  paused: "◆ PAUSED",
  completed: "✓ COMPLETED",
  cancelled: "✗ CANCELLED"
};

export function StreamStatusBadge({ status, preview = false }: { status: StreamStatus; preview?: boolean }) {
  return <span className={`stream-status ${preview ? "preview" : status}`}>{preview ? "PREVIEW" : labels[status]}</span>;
}

