import clsx from "clsx";

type Stat = {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
};

export default function StatCard({ label, value, sub, accent }: Stat) {
  return (
    <div
      className={clsx(
        "flex flex-col gap-1 rounded-xl border p-4",
        accent
          ? "border-violet-500/30 bg-violet-500/5"
          : "border-slate-800 bg-[#12121a]"
      )}
    >
      <span className="text-xs text-slate-500 uppercase tracking-wider">{label}</span>
      <span className={clsx("text-xl font-bold", accent ? "text-violet-300" : "text-white")}>
        {value}
      </span>
      {sub && <span className="text-xs text-slate-600">{sub}</span>}
    </div>
  );
}
