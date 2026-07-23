// Shared wallet-connection chip — "Connect wallet" when disconnected; the address plus
// a copy / wallet-view / disconnect menu when connected. Used by both the app nav and
// the landing nav so the connection reads the same everywhere.
import { useEffect, useRef, useState } from "react";
import { shortAddr } from "../config";
import {
  connect as kitConnect,
  disconnect as kitDisconnect,
  getAddress,
  onAddressChange,
} from "../lib/walletKit";
import "./appnav.css";

export default function WalletChip({
  onWalletView,
  variant = "solid",
}: {
  onWalletView?: () => void;
  variant?: "solid" | "ghost";
}) {
  const [address, setAddress] = useState<string | null>(getAddress());
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const walletRef = useRef<HTMLDivElement>(null);

  useEffect(() => onAddressChange(setAddress), []);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (walletRef.current && !walletRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  const connect = async () => {
    setConnecting(true);
    try {
      await kitConnect();
    } catch {
      // User closed the wallet modal — nothing to surface here.
    } finally {
      setConnecting(false);
    }
  };

  const copy = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked — the wallet view shows the address too.
    }
  };

  if (!address) {
    return (
      <button
        className={`anav__cta${variant === "ghost" ? " anav__cta--ghost" : ""}`}
        onClick={connect}
        disabled={connecting}
        type="button"
      >
        {connecting ? "Connecting…" : "Connect wallet"}
      </button>
    );
  }

  return (
    <div className="anav__wallet" ref={walletRef}>
      <button className="anav__chip" onClick={() => setMenuOpen((o) => !o)} type="button">
        <i className="anav__dot" /> {shortAddr(address)}
      </button>
      {menuOpen && (
        <div className="anav__menu">
          <button onClick={copy} type="button">
            {copied ? "Copied ✓" : "Copy address"}
          </button>
          {onWalletView && (
            <button
              onClick={() => {
                setMenuOpen(false);
                onWalletView();
              }}
              type="button"
            >
              Wallet details
            </button>
          )}
          <button
            onClick={() => {
              setMenuOpen(false);
              void kitDisconnect();
            }}
            type="button"
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
