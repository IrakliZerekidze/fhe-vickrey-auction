"use client";
import { useState } from "react";
import { Lock, Loader2, CheckCircle2 } from "lucide-react";
import clsx from "clsx";

type Props = { userAddress: string; alreadyBid: boolean; onSuccess: () => void; };
type Status = "idle" | "encrypting" | "sending" | "done" | "error";

export default function BidForm({ onSuccess }: Props) {
  const [amount, setAmount] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [txHash, setTxHash] = useState("");
  const [errMsg, setErrMsg] = useState("");
  const busy = status === "encrypting" || status === "sending";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const val = parseInt(amount);
    if (!val || val <= 0) return;
    if (!privateKey) { setErrMsg("Private key სავალდებულოა"); return; }
    setStatus("encrypting");
    setErrMsg("");
    try {
      setStatus("sending");
      const response = await fetch("http://localhost:3001/bid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: val, privateKey })
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      setTxHash(data.hash || "");
      setStatus("done");
      onSuccess();
    } catch (e: unknown) {
      setErrMsg(e instanceof Error ? e.message : "Transaction failed");
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="flex flex-col items-center gap-3 py-6">
        <CheckCircle2 className="text-emerald-400 w-12 h-12" />
        <p className="text-emerald-400 font-semibold text-lg">ბიდი დადებულია!</p>
        <p className="text-slate-400 text-sm text-center">შენი ბიდი დაშიფრულია ბლოქჩეინზე.</p>
        {txHash && <a href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" rel="noreferrer" className="text-violet-400 text-xs underline">Etherscan-ზე ნახვა ↗</a>}
        <button onClick={() => { setStatus("idle"); setAmount(""); }} className="text-slate-500 text-xs underline">კიდევ ბიდი</button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div>
        <label className="block text-sm text-slate-400 mb-1.5">ბიდის ოდენობა</label>
        <div className="relative">
          <input type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)}
            disabled={busy} placeholder="მაგ. 250"
            className={clsx("w-full bg-[#0d0d18] border rounded-lg px-4 py-3 text-white text-lg focus:outline-none focus:ring-2 focus:ring-violet-500 placeholder:text-slate-600 border-slate-700", busy && "opacity-50")} />
          <Lock className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 w-4 h-4" />
        </div>
      </div>
      <div>
        <label className="block text-sm text-slate-400 mb-1.5">Private Key <span className="text-slate-600">(0x...)</span></label>
        <input type="password" value={privateKey} onChange={e => setPrivateKey(e.target.value)}
          disabled={busy} placeholder="0x..."
          className={clsx("w-full bg-[#0d0d18] border rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 placeholder:text-slate-600 border-slate-700", busy && "opacity-50")} />
      </div>
      {errMsg && <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{errMsg}</p>}
      <button type="submit" disabled={busy || !amount || !privateKey}
        className={clsx("flex items-center justify-center gap-2 rounded-lg px-4 py-3 font-semibold transition-all bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-40")}>
        {busy ? (<><Loader2 className="w-4 h-4 animate-spin" />{status === "encrypting" ? "TFHE-ით დაშიფვრა..." : "გაგზავნა..."}</>) : (<><Lock className="w-4 h-4" />დალუქული ბიდის დადება</>)}
      </button>
    </form>
  );
}