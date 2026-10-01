"use client";
import { useState } from "react";

export function Toggle({ initial, endpoint, label }: { initial: boolean; endpoint: string; label: string }) {
  const [value,setValue]=useState(initial); const [busy,setBusy]=useState(false);
  async function toggle(){ setBusy(true); const next=!value; const r=await fetch(endpoint,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({value:next})}); if(r.ok)setValue(next); setBusy(false); }
  return <button disabled={busy} onClick={toggle} className={`flex items-center gap-2 text-sm ${value?"text-[#3e8654]":"text-slate-500"}`}><span className={`w-10 h-6 p-1 rounded-full transition ${value?"bg-[#78b38a]":"bg-slate-300"}`}><span className={`block w-4 h-4 bg-white rounded-full transition ${value?"translate-x-4":""}`} /></span>{label}: {value?"Bật":"Tắt"}</button>;
}
