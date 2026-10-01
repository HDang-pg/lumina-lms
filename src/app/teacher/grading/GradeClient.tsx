"use client";

import { useState } from "react";

function csrf() { return document.cookie.split(";").map(x => x.trim()).find(x => x.startsWith("lms_csrf="))?.split("=")[1] || ""; }

export default function GradeClient({ initial, focusAttemptId }: { initial: any[]; focusAttemptId: string | null }) {
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);

  async function grade(id: string, points: number, feedback: string) {
    setBusy(id);
    const r = await fetch("/api/grades", { method: "PATCH", headers: { "content-type": "application/json", "x-csrf-token": csrf() }, body: JSON.stringify({ answerId: id, pointsEarned: Number(points), feedback }) });
    if (r.ok) setItems(items.map(x => x.id === id ? { ...x, graded: true, pointsEarned: Number(points), feedback } : x));
    else alert((await r.json()).error || "Không thể lưu điểm.");
    setBusy(null);
  }

  return <div className="space-y-4">
    {items.map(a => <div key={a.id} className="card p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2"><div className="text-xs text-slate-400">{a.attempt.student.name} · {a.attempt.exam.title}</div><span className={`pill ${a.question.type === "ESSAY" ? "pill-orange" : "pill-blue"}`}>{a.question.type === "ESSAY" ? "Tự luận" : a.question.type === "SHORT_ANSWER" ? "Trả lời ngắn" : a.question.type === "TRUE_FALSE" ? "Đúng / Sai" : "Trắc nghiệm"}</span></div>
      <h2 className="font-semibold mt-2">{a.question.text}</h2>
      {a.question.type === "ESSAY" || a.question.type === "SHORT_ANSWER" ? <div className="mt-4 rounded-xl bg-slate-50 p-4 whitespace-pre-wrap text-sm">{a.textAnswer || "Chưa có nội dung"}</div> : <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Câu khách quan đã được hệ thống tự động chấm: <b>{a.pointsEarned}/{a.question.points}</b></div>}
      {a.fileKey && <div className="mt-4"><div className="text-xs text-slate-400 mb-2">Ảnh bài làm</div><img src={`/api/submissions/${a.id}`} alt="Ảnh bài làm học sinh" className="max-h-[520px] max-w-full rounded-xl border border-slate-200 object-contain"/></div>}
      {a.question.type === "ESSAY" && <GradeForm item={a} busy={busy === a.id} onSubmit={(p, f) => void grade(a.id, p, f)} />}
      {a.question.type !== "ESSAY" && focusAttemptId && <div className="mt-3 text-sm text-slate-500">Điểm hiện tại: <b>{a.pointsEarned}/{a.question.points}</b></div>}
    </div>)}
    {!items.length && <div className="card p-8 text-center text-slate-500">Không có bài tự luận đang chờ chấm.</div>}
  </div>;
}

function GradeForm({ item, busy, onSubmit }: { item: any; busy: boolean; onSubmit: (points: number, feedback: string) => void }) {
  const [p, setP] = useState(item.pointsEarned || 0);
  const [f, setF] = useState(item.feedback || "");
  return <div className="mt-4 grid md:grid-cols-[140px_1fr_auto] gap-2"><input type="number" min="0" max={item.question.points} step="0.25" className="input" value={p} onChange={e => setP(Number(e.target.value))}/><input className="input" placeholder="Nhận xét cho học sinh" value={f} onChange={e => setF(e.target.value)}/><button disabled={busy} className="btn btn-primary" onClick={() => onSubmit(p, f)}>{busy ? "Đang lưu…" : "Lưu điểm"}</button></div>;
}
