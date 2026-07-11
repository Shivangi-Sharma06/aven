"use client";

import styles from "./ConfirmModal.module.css";

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel,
  onConfirm,
  onClose
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <h2>{title}</h2>
        <p>{description}</p>
        <div className={styles.actions}>
          <button className="button ghost" onClick={onClose} type="button">Cancel</button>
          <button className="button danger" onClick={onConfirm} type="button">{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

