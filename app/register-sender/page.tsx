"use client";

import { useState } from "react";
import { useWallet } from "@/components/WalletProvider";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

export default function RegisterSenderPage() {
  const { connected } = useWallet();
  const router = useRouter();
  const [form, setForm] = useState({ name: "", proofUrl: "", type: "Individual" });

  return (
    <div className={styles.wrap}>
      <header className={styles.explainer}>
        <span className={styles.eyebrow}>Identity / Sender Profile</span>
        <h1>Register as sender.</h1>
        <p>Provide a public identity reference to establish trust when you fund work.</p>
      </header>

      <section className={styles.card}>
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            setTimeout(() => router.push("/dashboard"), 1000);
          }}
        >
          <label className={styles.field}>
            <span>Name / Organization</span>
            <input
              placeholder="Acme Corp"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </label>

          <label className={styles.field}>
            <span>Proof URL (Website/Social)</span>
            <input
              placeholder="https://..."
              value={form.proofUrl}
              onChange={(event) => setForm({ ...form, proofUrl: event.target.value })}
            />
          </label>

          <label className={styles.field}>
            <span>Entity Type</span>
            <select
              value={form.type}
              onChange={(event) => setForm({ ...form, type: event.target.value })}
            >
              <option>Individual</option>
              <option>Company</option>
              <option>DAO</option>
            </select>
          </label>

          <button
            className={styles.submit}
            type="submit"
            disabled={!connected}
          >
            {connected ? "Submit registration" : "Connect wallet to continue"}
          </button>
        </form>
      </section>
    </div>
  );
}
