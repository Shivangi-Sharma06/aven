import { CheckCircle2, Clock, XCircle } from "lucide-react";

export function StatusBadge({ status, label }: { status: "success" | "warning" | "danger"; label: string }) {
  const Icon = status === "success" ? CheckCircle2 : status === "warning" ? Clock : XCircle;
  return (
    <span className={`status ${status}`}>
      <Icon size={14} /> {label}
    </span>
  );
}
