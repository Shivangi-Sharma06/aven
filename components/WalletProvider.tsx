"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  checkFreighterInstalled,
  connectWallet as connectFreighter,
  disconnectWallet as disconnectFreighter,
  getConnectedWallet,
  watchWalletChanges,
} from "@/lib/stellar";
import { NETWORK_PASSPHRASE } from "@/lib/contracts";

export type WalletContextValue = {
  address: string | null;
  connected: boolean;
  connecting: boolean;
  hasFreighter: boolean | null; // null = not yet checked
  restoring: boolean;
  knownAddresses: string[];
  connect: () => Promise<void>;
  disconnect: () => void;
  selectAddress: (address: string) => void;
  openConnectModal: () => void;
};

const WalletContext = createContext<WalletContextValue | null>(null);

export function useWallet() {
  const value = useContext(WalletContext);
  if (!value) throw new Error("useWallet must be used inside WalletProvider");
  return value;
}

// Internal: emitter to open the modal from anywhere
let _openModalFn: (() => void) | null = null;
export function _registerOpenModal(fn: () => void) { _openModalFn = fn; }

const LAST_WALLET_KEY = "aven:last-wallet-address";
const KNOWN_WALLETS_KEY = "aven:known-wallet-addresses";

function readKnownAddresses() {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KNOWN_WALLETS_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

function rememberAddress(address: string) {
  if (typeof window === "undefined") return [];
  const known = [address, ...readKnownAddresses().filter((item) => item.toLowerCase() !== address.toLowerCase())].slice(0, 8);
  window.localStorage.setItem(LAST_WALLET_KEY, address);
  window.localStorage.setItem(KNOWN_WALLETS_KEY, JSON.stringify(known));
  return known;
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return window.localStorage.getItem(LAST_WALLET_KEY);
    }
    return null;
  });
  const [connecting, setConnecting] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [hasFreighter, setHasFreighter] = useState<boolean | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [knownAddresses, setKnownAddresses] = useState<string[]>([]);

  useEffect(() => {
    let mounted = true;
    setKnownAddresses(readKnownAddresses());
    checkFreighterInstalled().then((installed) => {
      if (mounted) setHasFreighter(installed);
    });
    getConnectedWallet()
      .then((wallet) => {
        if (!mounted) return;
        if (wallet) {
          setAddress(wallet.address);
          setHasFreighter(true);
          setKnownAddresses(rememberAddress(wallet.address));
        }
      })
      .finally(() => {
        if (mounted) setRestoring(false);
      });
    const stopWatching = watchWalletChanges((next) => {
      if (!mounted) return;
      if (next.networkPassphrase !== NETWORK_PASSPHRASE) {
        setAddress(null);
        setWalletError("Switch Freighter to Stellar Testnet, then try connecting again.");
        return;
      }
      setWalletError(null);
      setAddress(next.address);
      setKnownAddresses(rememberAddress(next.address));
    });
    return () => {
      mounted = false;
      stopWatching();
    };
  }, []);

  const connect = useCallback(async () => {
    setConnecting(true);
    setWalletError(null);
    try {
      const { address: addr } = await connectFreighter();
      setAddress(addr);
      setKnownAddresses(rememberAddress(addr));
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
    disconnectFreighter();
    if (typeof window !== "undefined") window.localStorage.removeItem(LAST_WALLET_KEY);
    setAddress(null);
  }, []);

  const selectAddress = useCallback((nextAddress: string) => {
    setAddress(nextAddress);
    setKnownAddresses(rememberAddress(nextAddress));
  }, []);

  const openConnectModal = useCallback(() => setShowModal(true), []);

  useEffect(() => {
    _registerOpenModal(() => setShowModal(true));
  }, []);

  const value = useMemo<WalletContextValue>(
    () => ({
      address,
      connected: Boolean(address),
      connecting,
      hasFreighter,
      restoring,
      knownAddresses,
      connect,
      disconnect,
      selectAddress,
      openConnectModal,
    }),
    [address, connecting, hasFreighter, restoring, knownAddresses, connect, disconnect, selectAddress, openConnectModal]
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
          knownAddresses={knownAddresses}
          error={walletError}
          onConnect={connect}
          onSelectAddress={selectAddress}
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
  knownAddresses,
  error,
  onConnect,
  onSelectAddress,
  onRetryDetection,
  onDisconnect,
  onClose,
}: {
  hasFreighter: boolean | null;
  connecting: boolean;
  connected: boolean;
  address: string | null;
  knownAddresses: string[];
  error: string | null;
  onConnect: () => Promise<void>;
  onSelectAddress: (address: string) => void;
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
            {knownAddresses.length > 1 && (
              <label className="wallet-modal-field">
                <span>Use address</span>
                <select value={address} onChange={(event) => onSelectAddress(event.target.value)}>
                  {knownAddresses.map((knownAddress) => (
                    <option key={knownAddress} value={knownAddress}>
                      {truncate(knownAddress)}
                    </option>
                  ))}
                </select>
              </label>
            )}
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
