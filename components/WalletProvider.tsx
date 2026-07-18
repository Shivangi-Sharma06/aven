"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  checkFreighterInstalled,
  connectWallet as connectFreighter,
  disconnectWallet as disconnectFreighter,
  restoreWallet,
  watchWallet,
} from "@/lib/stellar";

export type WalletContextValue = {
  address: string | null;
  connected: boolean;
  connecting: boolean;
  hasFreighter: boolean | null; // null = not yet checked
  connect: () => Promise<void>;
  disconnect: () => void;
  openConnectModal: () => void;
};

const WalletContext = createContext<WalletContextValue | null>(null);
const MANUAL_DISCONNECT_KEY = "aven:wallet-manually-disconnected";

export function useWallet() {
  const value = useContext(WalletContext);
  if (!value) throw new Error("useWallet must be used inside WalletProvider");
  return value;
}

// Internal: emitter to open the modal from anywhere
let _openModalFn: (() => void) | null = null;
export function _registerOpenModal(fn: () => void) { _openModalFn = fn; }

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [hasFreighter, setHasFreighter] = useState<boolean | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const manuallyDisconnected = useRef(false);

  useEffect(() => {
    let active = true;
    manuallyDisconnected.current = window.localStorage.getItem(MANUAL_DISCONNECT_KEY) === "1";
    async function restore() {
      const installed = await checkFreighterInstalled();
      if (!active) return;
      setHasFreighter(installed);
      if (!installed || manuallyDisconnected.current) return;
      try {
        const wallet = await restoreWallet();
        if (!active || manuallyDisconnected.current) return;
        setAddress(wallet?.address ?? null);
        setWalletError(null);
      } catch (error) {
        if (!active) return;
        setAddress(null);
        setWalletError(error instanceof Error ? error.message : String(error));
      }
    }
    void restore();
    const stopWatching = watchWallet(({ address: nextAddress, error }) => {
      if (!active || manuallyDisconnected.current) return;
      if (error) {
        setAddress(null);
        setWalletError(error);
        return;
      }
      setHasFreighter(true);
      setAddress(nextAddress);
      setWalletError(null);
    });
    return () => {
      active = false;
      stopWatching();
    };
  }, []);

  const connect = useCallback(async () => {
    setConnecting(true);
    setWalletError(null);
    try {
      const { address: addr } = await connectFreighter();
      manuallyDisconnected.current = false;
      window.localStorage.removeItem(MANUAL_DISCONNECT_KEY);
      setAddress(addr);
      setHasFreighter(true);
      setShowModal(false);
    } catch (error) {
      setWalletError(error instanceof Error ? error.message : String(error));
      setHasFreighter(await checkFreighterInstalled());
    } finally {
      setConnecting(false);
    }
  }, []);

  const retryFreighterDetection = useCallback(async () => {
    setWalletError(null);
    setHasFreighter(null);
    setHasFreighter(await checkFreighterInstalled());
  }, []);

  const disconnect = useCallback(() => {
    manuallyDisconnected.current = true;
    window.localStorage.setItem(MANUAL_DISCONNECT_KEY, "1");
    void disconnectFreighter();
    setAddress(null);
  }, []);

  const openConnectModal = useCallback(() => setShowModal(true), []);

  useEffect(() => {
    _registerOpenModal(() => setShowModal(true));
  }, []);

  const value = useMemo<WalletContextValue>(
    () => ({ address, connected: Boolean(address), connecting, hasFreighter, connect, disconnect, openConnectModal }),
    [address, connecting, hasFreighter, connect, disconnect, openConnectModal]
  );

  return (
    <WalletContext.Provider value={value}>
      {children}
      {showModal && (
        <ConnectWalletModal
          hasFreighter={hasFreighter}
          connecting={connecting}
          connected={Boolean(address)}
          address={address}
          error={walletError}
          onConnect={connect}
          onRetryDetection={retryFreighterDetection}
          onDisconnect={() => { disconnect(); setShowModal(false); }}
          onClose={() => setShowModal(false)}
        />
      )}
    </WalletContext.Provider>
  );
}

// ─── Inline modal (no Mantine modals dependency) ──────────────────────────────

function ConnectWalletModal({
  hasFreighter,
  connecting,
  connected,
  address,
  error,
  onConnect,
  onRetryDetection,
  onDisconnect,
  onClose,
}: {
  hasFreighter: boolean | null;
  connecting: boolean;
  connected: boolean;
  address: string | null;
  error: string | null;
  onConnect: () => Promise<void>;
  onRetryDetection: () => Promise<void>;
  onDisconnect: () => void;
  onClose: () => void;
}) {
  const truncate = (s: string) => s.slice(0, 6) + "..." + s.slice(-4);

  return (
    <div className="wallet-modal-overlay" onClick={onClose}>
      <div className="wallet-modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="wallet-modal-close" onClick={onClose}>✕</button>

        <div className="wallet-modal-logo">
          {/* Freighter icon SVG */}
          <svg width="48" height="48" viewBox="0 0 64 64" fill="none">
            <rect width="64" height="64" rx="16" fill="#6C47FF" />
            <path d="M16 20h32v6H16zM16 32h20v6H16zM16 44h26v6H16z" fill="white" />
          </svg>
        </div>

        <h2 className="wallet-modal-title">
          {connected ? "Wallet Connected" : "Connect Freighter"}
        </h2>

        {connected && address ? (
          <>
            <div className="wallet-modal-address">{truncate(address)}</div>
            <p className="wallet-modal-sub">Your Stellar wallet is connected to Aven.</p>
            <button className="wallet-modal-btn-secondary" onClick={onDisconnect}>
              Disconnect
            </button>
          </>
        ) : hasFreighter === false ? (
          <>
            <p className="wallet-modal-sub">
              Aven could not detect Freighter in this browser. If it is already installed,
              unlock it, allow it on localhost, and try the connection directly.
            </p>
            {error && <div className="wallet-modal-error">{error}</div>}
            <button
              className="wallet-modal-btn"
              onClick={onConnect}
              disabled={connecting}
            >
              {connecting ? <span className="wallet-modal-spinner" /> : "Try Freighter Connection"}
            </button>
            <button className="wallet-modal-btn-secondary" onClick={onRetryDetection} disabled={connecting}>
              Check Again
            </button>
            <a
              className="wallet-modal-install-link"
              href="https://www.freighter.app/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Freighter is not installed? Download it ↗
            </a>
          </>
        ) : (
          <>
            <p className="wallet-modal-sub">
              Freighter will ask you to approve the connection to Aven.
            </p>
            {error && <div className="wallet-modal-error">{error}</div>}
            <button
              className="wallet-modal-btn"
              onClick={onConnect}
              disabled={connecting}
            >
              {connecting ? (
                <span className="wallet-modal-spinner" />
              ) : (
                "Connect with Freighter"
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
