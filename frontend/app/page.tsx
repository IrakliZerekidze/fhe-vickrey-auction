"use client";

import { useState, useCallback } from "react";
import { Shield, Lock, Eye, EyeOff, ExternalLink, RefreshCw, Trophy, AlertCircle } from "lucide-react";
import { settleAuction } from "../lib/auction";
import { useAuction } from "../lib/auction";
import { CONTRACT_ADDRESS } from "../lib/contract";
import WalletButton from "./components/WalletButton";
import BidForm from "./components/BidForm";
import Countdown from "./components/Countdown";
import StatCard from "./components/StatCard";
import clsx from "clsx";

function short(addr: string) {
  if (!addr || addr === "0x0000000000000000000000000000000000000000") return "—";
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

export default function Home() {
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [settling, setSettling] = useState(false);
  const [settleError, setSettleError] = useState("");
  const [settleTx, setSettleTx] = useState("");

  const { state, loading, error, refresh } = useAuction(userAddress);

  const handleConnected = useCallback((addr: string) => setUserAddress(addr), []);
  const handleDisconnected = useCallback(() => setUserAddress(null), []);

  const auctionOver = state.timeRemaining === 0 && state.endTime > 0;
  const canSettle = auctionOver && !state.settled;

  async function handleSettle() {
    setSettling(true);
    setSettleError("");
    try {
      const hash = await settleAuction();
      setSettleTx(hash);
      refresh();
    } catch (e: unknown) {
      setSettleError(e instanceof Error ? e.message : "Settle failed");
    } finally {
      setSettling(false);
    }
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      {/* Header */}
      <header className="border-b border-slate-800 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-violet-600/20 border border-violet-500/30">
              <Shield className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h1 className="text-white font-bold text-lg leading-none">ZK Vickrey Auction</h1>
              <p className="text-slate-500 text-xs mt-0.5">FHE-encrypted · Second-price · Sepolia</p>
            </div>
          </div>
          <WalletButton onConnected={handleConnected} onDisconnected={handleDisconnected} />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10 flex flex-col gap-8">

        {/* Hero explanation */}
        <div className="rounded-2xl border border-slate-800 bg-[#0e0e1a] p-6">
          <h2 className="text-white font-semibold text-xl mb-2">How it works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
            {[
              {
                icon: <Lock className="w-5 h-5 text-violet-400" />,
                title: "Encrypted bids",
                desc: "Your bid is encrypted client-side with TFHE. The smart contract stores only ciphertext — no one can see your amount.",
              },
              {
                icon: <EyeOff className="w-5 h-5 text-violet-400" />,
                title: "Homomorphic max",
                desc: "The contract finds the highest and second-highest bids by computing directly on encrypted data.",
              },
              {
                icon: <Eye className="w-5 h-5 text-violet-400" />,
                title: "Vickrey reveal",
                desc: "After settlement: winner's address and payment price (second-highest bid) are revealed. Losing bids stay private forever.",
              },
            ].map((step) => (
              <div key={step.title} className="flex flex-col gap-2 p-4 rounded-xl bg-[#12121a] border border-slate-800">
                <div className="flex items-center gap-2">
                  {step.icon}
                  <span className="text-white font-medium text-sm">{step.title}</span>
                </div>
                <p className="text-slate-400 text-xs leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Contract address pill */}
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>Contract:</span>
          <a
            href={`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-violet-400 hover:text-violet-300 font-mono transition-colors"
          >
            {CONTRACT_ADDRESS}
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* Auction state */}
        {loading ? (
          <div className="flex items-center gap-3 text-slate-500 py-8">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Loading auction state...
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-xl px-4 py-3 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        ) : (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard
                label="Status"
                value={state.settled ? "Settled" : auctionOver ? "Ended" : "Live"}
                sub={state.settled ? "Winner announced" : auctionOver ? "Awaiting settlement" : "Accepting bids"}
                accent={!state.settled && !auctionOver}
              />
              <StatCard
                label="Bidders"
                value={String(state.bidderCount)}
                sub="Sealed bids"
              />
              <StatCard
                label="Beneficiary"
                value={short(state.beneficiary)}
                sub="Receives payment"
              />
              {state.settled ? (
                <StatCard
                  label="Winner"
                  value="Encrypted"
                  sub="Pays second-price"
                  accent
                />
              ) : (
                <StatCard
                  label="Your bid"
                  value={state.userHasBid ? "Placed ✓" : userAddress ? "None yet" : "—"}
                  sub={state.userHasBid ? "Encrypted on-chain" : "Connect wallet to bid"}
                />
              )}
            </div>

            {/* Countdown or settled banner */}
            {!state.settled && (
              <div className="rounded-2xl border border-slate-800 bg-[#0e0e1a] p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <p className="text-slate-400 text-sm mb-1">
                      {auctionOver ? "Auction ended" : "Time remaining"}
                    </p>
                    {state.endTime > 0 && !auctionOver && (
                      <Countdown endTime={state.endTime} />
                    )}
                    {auctionOver && (
                      <p className="text-amber-400 font-semibold">
                        Auction ended — settlement pending
                      </p>
                    )}
                  </div>
                  <button
                    onClick={refresh}
                    className="self-start sm:self-center flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-xs transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Refresh
                  </button>
                </div>
              </div>
            )}

            {/* Winner banner */}
            {state.settled && (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6 flex items-start gap-4">
                <Trophy className="w-8 h-8 text-amber-400 shrink-0 mt-1" />
                <div>
                  <p className="text-amber-300 font-bold text-lg">Auction Settled</p>
                  <p className="text-slate-400 text-sm mt-1">
                    Winner: <span className="text-slate-400 text-sm">Reveal via fhevmjs SDK</span>
                  </p>
                  <p className="text-slate-500 text-xs mt-2">
                    The winner pays the second-highest bid (Vickrey price). 
                    All losing bids remain encrypted and are never revealed.
                  </p>
                  {settleTx && (
                    <a
                      href={`https://sepolia.etherscan.io/tx/${settleTx}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-violet-400 text-xs underline mt-2 block"
                    >
                      Settlement tx ↗
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Settle button */}
            {canSettle && userAddress && (
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleSettle}
                  disabled={settling}
                  className={clsx(
                    "flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all",
                    "bg-amber-500 hover:bg-amber-400 text-black",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  {settling ? "Settling..." : "Settle Auction"}
                </button>
                {settleError && (
                  <p className="text-red-400 text-sm">{settleError}</p>
                )}
                <p className="text-slate-600 text-xs text-center">
                  Anyone can call settle() — it's permissionless.
                </p>
              </div>
            )}

            {/* Bid form */}
            {!state.settled && !auctionOver && (
              <div className="rounded-2xl border border-slate-800 bg-[#0e0e1a] p-6">
                <h2 className="text-white font-semibold text-lg mb-1">Place your sealed bid</h2>
                <p className="text-slate-500 text-sm mb-6">
                  Your bid is encrypted in your browser before being sent. The contract
                  stores only ciphertext — not even the auctioneer can see it.
                </p>

                {!userAddress ? (
                  <div className="text-center py-8 text-slate-500">
                    <Lock className="w-8 h-8 mx-auto mb-3 text-slate-700" />
                    <p>Connect your wallet to place a bid</p>
                  </div>
                ) : (
                  <BidForm
                    userAddress={userAddress}
                    alreadyBid={state.userHasBid}
                    onSuccess={refresh}
                  />
                )}
              </div>
            )}
          </>
        )}

        {/* Threat model callout */}
        <div className="rounded-2xl border border-slate-800 bg-[#0e0e1a] p-6">
          <h3 className="text-slate-300 font-medium mb-3 flex items-center gap-2">
            <Shield className="w-4 h-4 text-violet-400" />
            Threat model
          </h3>
          <div className="space-y-2 text-xs text-slate-500 leading-relaxed">
            <p><span className="text-slate-300">What stays private:</span> All individual bid amounts, permanently encrypted. Losing bidders learn nothing about other bids.</p>
            <p><span className="text-slate-300">What is revealed:</span> Winner's address (by design — Vickrey auctions publicly announce winners), and the payment price (second-highest bid) after settlement.</p>
            <p><span className="text-slate-300">Trust assumption:</span> Zama's threshold MPC key management system. The private FHE key is split across validators — decryption requires a threshold of colluding parties, not a single trusted entity.</p>
            <p><span className="text-slate-300">Attack vector:</span> If a threshold of KMS validators collude, they could decrypt individual bids. This is a known limitation of threshold FHE schemes.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
