"use client";

import { Copy } from "lucide-react";
import { truncateMiddle } from "@/lib/format";
import { useToast } from "./ToastProvider";
import styles from "./CopyPill.module.css";

export function CopyPill({ value, full = false, title }: { value: string; full?: boolean; title?: string }) {
  const toast = useToast();
  return (
    <span className="mono-pill" title={title ?? value}>
      <span>{full ? value : truncateMiddle(value)}</span>
      <button
        aria-label="Copy value"
        className={styles.copy}
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          toast("success", "Copied");
        }}
        type="button"
      >
        <Copy size={13} />
      </button>
    </span>
  );
}
