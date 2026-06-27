"use client";

import { useState, useEffect } from "react";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export default function Countdown({ endTime }: { endTime: number }) {
  const [diff, setDiff] = useState(endTime - Math.floor(Date.now() / 1000));

  useEffect(() => {
    const id = setInterval(() => {
      setDiff(endTime - Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [endTime]);

  if (diff <= 0) {
    return (
      <span className="text-amber-400 font-mono font-bold text-lg">
        Auction ended
      </span>
    );
  }

  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;

  return (
    <div className="flex gap-3 items-end">
      {[
        { label: "HRS", val: h },
        { label: "MIN", val: m },
        { label: "SEC", val: s },
      ].map(({ label, val }) => (
        <div key={label} className="flex flex-col items-center">
          <span className="font-mono text-3xl font-bold text-violet-400 tabular-nums">
            {pad(val)}
          </span>
          <span className="text-xs text-slate-500 tracking-widest">{label}</span>
        </div>
      ))}
    </div>
  );
}
