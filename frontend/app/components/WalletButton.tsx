"use client";

import { useState, useEffect } from "react";
import { Wallet, LogOut, Copy, Check } from "lucide-react";
import { BrowserProvider } from "ethers";
import clsx from "clsx";

type Props = {
  onConnected: (address: string) => void;
  onDisconnected: () => void;
};

function short(addr: string) {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

export default function WalletButton({ onConnected, onDisconnected }: Props) {
  const [address, setAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Auto-reconnect if already authorised
    if (window.ethereum?.selectedAddress) {
      setAddress(window.ethereum.selectedAddress);
      onConnected(window.ethereum.selectedAddress);
    }
  }, [onConnected]);

  async function connect() {
    if (!window.ethereum) {
      alert("Please install MetaMask");
      return;
    }
    setLoading(true);
    try {
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const addr = await signer.getAddress();
      setAddress(addr);
      onConnected(addr);
    } catch {
      // user rejected
    } finally {
      setLoading(false);
    }
  }

  function disconnect() {
    setAddress(null);
    onDisconnected();
  }

  async function copy() {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (!address) {
    return (
      <button
        onClick={connect}
        disabled={loading}
        className={clsx(
          "flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm",
          "bg-violet-600 hover:bg-violet-500 text-white transition-colors",
          "disabled:opacity-50 disabled:cursor-not-allowed"
        )}
      >
        <Wallet className="w-4 h-4" />
        {loading ? "Connecting..." : "Connect Wallet"}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 bg-[#1a1a2e] border border-slate-700 rounded-lg px-3 py-1.5">
      <div className="w-2 h-2 rounded-full bg-emerald-400" />
      <span className="text-sm text-slate-300 font-mono">{short(address)}</span>
      <button onClick={copy} className="text-slate-500 hover:text-slate-300 transition-colors">
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
      <button onClick={disconnect} className="text-slate-500 hover:text-red-400 transition-colors ml-1">
        <LogOut className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
