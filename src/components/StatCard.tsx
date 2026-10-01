export function StatCard({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return <div className="card p-5 hover-lift"><div className="text-sm text-slate-500">{label}</div><div className="text-3xl font-bold mt-2 tracking-tight">{value}</div>{note && <div className="text-xs text-slate-400 mt-2">{note}</div>}</div>;
}
