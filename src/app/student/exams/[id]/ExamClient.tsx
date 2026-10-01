"use client";

import { useEffect, useState } from "react";

export type ExamQuestion = {
  id: string;
  text: string;
  type: "MCQ" | "TRUE_FALSE" | "SHORT_ANSWER" | "ESSAY";
  points: number;
  options: { id: string; text: string }[];
};

function getCsrf() {
  return document.cookie.split(";").map(x => x.trim()).find(x => x.startsWith("lms_csrf="))?.split("=")[1] || "";
}

export default function ExamClient({ examId, title, durationMin, questions, existingAnswers }: { examId: string; title: string; durationMin: number; questions: ExamQuestion[]; existingAnswers: Record<string, string> }) {
  const [answers, setAnswers] = useState(existingAnswers);
  const [files, setFiles] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const [left, setLeft] = useState(durationMin * 60);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [result, setResult] = useState<{ score: number; pendingEssay: boolean } | null>(null);

  useEffect(() => {
    const started = Number(localStorage.getItem(`lms_exam_${examId}_start`)) || Date.now();
    localStorage.setItem(`lms_exam_${examId}_start`, String(started));
    let submittedByTimeout = false;
    const t = setInterval(() => {
      const s = Math.max(0, durationMin * 60 - Math.floor((Date.now() - started) / 1000));
      setLeft(s);
      if (s <= 0 && !submittedByTimeout) {
        submittedByTimeout = true;
        void submit(true);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [durationMin, examId]);

  async function submit(auto = false) {
    if (submitting || done) return;
    setSubmitting(true);
    const r = await fetch(`/api/exams/${examId}/submit`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": getCsrf() },
      body: JSON.stringify({ answers, files, autoSubmitted: auto }),
    });
    const d = await r.json();
    if (r.ok) {
      setResult(d);
      setDone(true);
      localStorage.removeItem(`lms_exam_${examId}_start`);
    } else alert(d.error || "Không thể nộp bài");
    setSubmitting(false);
  }

  const mins = Math.floor(left / 60).toString().padStart(2, "0");
  const secs = (left % 60).toString().padStart(2, "0");

  if (done && result) return <div className="min-h-screen bg-[var(--bg)] px-4 py-10"><div className="card p-8 text-center max-w-xl mx-auto"><div className="text-5xl font-bold">{result.score.toFixed(1)}<span className="text-lg text-slate-400">/10</span></div><h2 className="text-xl font-bold mt-4">Đã nộp bài</h2><p className="text-slate-500 mt-2">{result.pendingEssay ? "Phần tự luận đã được gửi và đang chờ giáo viên chấm." : "Kết quả đã được ghi vào sổ điểm."}</p><a href="/student/gradebook" className="btn btn-primary inline-block mt-5">Xem sổ điểm</a></div></div>;

  return <div className="min-h-screen bg-[var(--bg)]"><div className="container-page fade-in max-w-5xl"><div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-5"><div><div className="text-sm text-slate-500">Phòng thi trực tuyến</div><h1 className="text-3xl font-bold mt-1">{title}</h1></div><div className={`card px-4 py-3 font-mono text-xl font-bold ${left < 60 ? "text-red-600" : ""}`}>⏱ {mins}:{secs}</div></div>
    <div className="space-y-4">{questions.map((q, i) => <section key={q.id} className="card p-5"><div className="flex justify-between gap-4"><div className="font-semibold">Câu {i + 1}. {q.text}</div><span className="text-xs text-slate-400 whitespace-nowrap">{q.points}đ</span></div>
      {q.type === "ESSAY" ? <div><textarea className="input mt-4 min-h-32" placeholder="Nhập bài giải / lập luận…" value={answers[q.id] || ""} onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })} /><div className="mt-3 flex flex-wrap items-center gap-3"><label className="btn btn-secondary cursor-pointer">{uploading === q.id ? "Đang tải ảnh…" : "📷 Chụp / chọn ảnh vở"}<input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={!!uploading} onChange={async e => { const f = e.target.files?.[0]; if (!f) return; setUploading(q.id); const fd = new FormData(); fd.set("file", f); fd.set("examId", examId); const r = await fetch("/api/submission-upload", { method: "POST", headers: { "x-csrf-token": getCsrf() }, body: fd }); const d = await r.json(); if (r.ok) setFiles({ ...files, [q.id]: d.storageKey }); else alert(d.error || "Không thể tải ảnh"); setUploading(null); }} /></label>{files[q.id] && <span className="pill pill-green">✓ Đã đính kèm ảnh</span>}</div></div>
      : q.type === "SHORT_ANSWER" ? <div className="mt-4"><label className="text-xs font-semibold text-slate-500">Câu trả lời ngắn</label><input className="input mt-1" inputMode="decimal" placeholder="Nhập đáp án" value={answers[q.id] || ""} onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })} /></div>
      : <div className="grid gap-2 mt-4">{q.options.map((o, idx) => <label key={o.id} className={`border rounded-xl p-3 flex gap-3 cursor-pointer hover:bg-slate-50 ${answers[q.id] === o.id ? "border-[#4f7cac] bg-[#edf5fc]" : "border-slate-200"}`}><input type="radio" name={q.id} checked={answers[q.id] === o.id} onChange={() => setAnswers({ ...answers, [q.id]: o.id })} /><span>{String.fromCharCode(65 + idx)}. {o.text}</span></label>)}</div>}
    </section>)}</div>
    <div className="sticky bottom-3 mt-5 flex justify-end"><button disabled={submitting} onClick={() => void submit(false)} className="btn btn-primary">{submitting ? "Đang nộp…" : "Nộp bài"}</button></div>
  </div></div>;
}
