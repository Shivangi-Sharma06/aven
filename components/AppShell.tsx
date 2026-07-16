"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, PlusCircle, User, ShieldCheck, Award, Wallet, LogOut } from "lucide-react";
import { useWallet } from "./WalletProvider";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { connected, address, openConnectModal, disconnect } = useWallet();

  if (pathname === "/") {
    return <>{children}</>;
  }

  const truncate = (addr: string) => addr.slice(0, 4) + "…" + addr.slice(-4);

  return (
    <div className="app-layout">
      <main className="main-content">{children}</main>

      <nav className="bottom-nav">
        <Link href="/dashboard" className={`nav-item ${pathname === "/dashboard" ? "active" : ""}`}>
          <LayoutDashboard size={20} />
          <span>Streams</span>
        </Link>
        <Link
          href="/stream/create"
          className={`nav-item ${pathname === "/stream/create" ? "active" : ""}`}
        >
          <PlusCircle size={24} />
          <span>Create</span>
        </Link>
        <Link href={connected && address ? `/profile/${address}` : "/profile"} className={`nav-item ${pathname?.startsWith("/profile") ? "active" : ""}`}>
          <User size={20} />
          <span>Profile</span>
        </Link>
        <Link href="/verify" className={`nav-item ${pathname === "/verify" ? "active" : ""}`}>
          <ShieldCheck size={20} />
          <span>Verify</span>
        </Link>
        <Link href="/agents" className={`nav-item ${pathname === "/agents" ? "active" : ""}`}>
          <Award size={20} />
          <span>Reputation</span>
        </Link>

        <div className="nav-wallet-status">
          {!connected ? (
            <button className="wallet-btn" onClick={openConnectModal} id="connect-wallet-btn">
              <Wallet size={14} style={{ marginRight: 4 }} />
              Connect
            </button>
          ) : (
            <div className="wallet-badge-group">
              <Link href={`/profile/${address}`} className="wallet-badge">
                {truncate(address || "")}
              </Link>
              <button className="wallet-disconnect-btn" onClick={disconnect} title="Disconnect">
                <LogOut size={12} />
              </button>
            </div>
          )}
        </div>
      </nav>
    </div>
  );
}
