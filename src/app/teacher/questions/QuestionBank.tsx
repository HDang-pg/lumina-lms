"use client";

import { useMemo, useState } from "react";

function csrf() {
  return document.cookie.split(";").map(x => x.trim()).find(x => x.startsWith("lms_csrf="))?.split("=")[1] || "";
}

type QuestionType = "MCQ" | "TRUE_FALSE" | "SHORT_ANSWER" | "ESSAY";

type Course = { id: string; title: string };

type Question = {
  id: string;
  courseId: string | null;
  topic: string;
  difficulty: string;
  type: QuestionType;
  text: string;
  points: number;
};

const emptyOptions = ["", "", "", ""];

export default function QuestionBank({ courses, initial }: { courses: Course[]; initial: Question[] }) {
  const [questions, setQuestions] = useState(initial);
  const [q, setQ] = useState({
    courseId: courses[0]?.id || "",
    topic: "Nhiệt học",
    difficulty: "NHAN_BIET",
    type: "MCQ" as QuestionType,
    text: "",
    points: 1,
    explanation: "",
    answerKey: "",
  });
  const [opts, setOpts] = useState<string[]>(emptyOptions);
  const [correct, setCorrect] = useState(0);
  const [busy, setBusy] = useState(false);

  function changeType(type: QuestionType) {
    setQ({ ...q, type });
    if (type === "TRUE_FALSE") {
      setOpts(["Đúng", "Sai"]);
      setCorrect(0);
    } else if (type === "MCQ") {
      setOpts(opts.length === 4 ? opts : emptyOptions);
      setCorrect(0);
    } else {
      setOpts(emptyOptions);
    }
  }

  async function add() {
    if (!q.text.trim()) return alert("Nhập nội dung câu hỏi.");
    if (q.type === "SHORT_ANSWER" && !q.answerKey.trim()) return alert("Nhập đáp án chuẩn cho câu trả lời ngắn.");
    setBusy(true);
    const options = q.type === "ESSAY" || q.type === "SHORT_ANSWER"
      ? []
      : opts.filter(Boolean).map((text, i) => ({ text, isCorrect: i === correct }));

    const r = await fetch("/api/questions", {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": csrf() },
      body: JSON.stringify({ ...q, points: Number(q.points), options, answerKey: q.type === "SHORT_ANSWER" ? q.answerKey : null }),
    });
    const d = await r.json();
    if (r.ok) {
      setQuestions([{ ...d.question, courseId: q.courseId || null }, ...questions]);
      setQ({ ...q, text: "", answerKey: "" });
      setOpts(q.type === "TRUE_FALSE" ? ["Đúng", "Sai"] : emptyOptions);
      setCorrect(0);
    } else alert(d.error || "Không thể lưu câu hỏi.");
    setBusy(false);
  }

  const typeText = useMemo(() => ({ MCQ: "Trắc nghiệm", TRUE_FALSE: "Đúng / Sai", SHORT_ANSWER: "Trả lời ngắn", ESSAY: "Tự luận" } as Record<QuestionType, string>), []);

  return <div>
    <section className="card p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-bold text-lg">Tạo câu hỏi</h2>
          <p className="text-sm text-slate-500 mt-1">Hỗ trợ 4 dạng: trắc nghiệm, đúng/sai, trả lời ngắn và tự luận.</p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-3 mt-4">
        <div>
          <label className="text-xs font-semibold text-slate-500">Môn / khóa học</label>
          <select className="input mt-1" value={q.courseId} onChange={e => setQ({ ...q, courseId: e.target.value })}>
            <option value="">Ngân hàng dùng chung</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500">Chuyên đề</label>
          <input className="input mt-1" value={q.topic} onChange={e => setQ({ ...q, topic: e.target.value })} placeholder="Chuyên đề" />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500">Mức độ</label>
          <select className="input mt-1" value={q.difficulty} onChange={e => setQ({ ...q, difficulty: e.target.value })}>
            <option value="NHAN_BIET">Nhận biết</option>
            <option value="THONG_HIEU">Thông hiểu</option>
            <option value="VAN_DUNG">Vận dụng</option>
            <option value="VAN_DUNG_CAO">Vận dụng cao</option>
          </select>
        </div>
      </div>

      <div className="grid md:grid-cols-[1fr_140px] gap-3 mt-3">
        <div>
          <label className="text-xs font-semibold text-slate-500">Dạng câu hỏi</label>
          <select className="input mt-1" value={q.type} onChange={e => changeType(e.target.value as QuestionType)}>
            <option value="MCQ">Trắc nghiệm</option>
            <option value="TRUE_FALSE">Đúng / Sai</option>
            <option value="SHORT_ANSWER">Trả lời ngắn</option>
            <option value="ESSAY">Tự luận</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500">Điểm</label>
          <input className="input mt-1" type="number" min="0.5" max="20" step="0.5" value={q.points} onChange={e => setQ({ ...q, points: Number(e.target.value) })} />
        </div>
      </div>

      <textarea className="input mt-3 min-h-28" placeholder="Nội dung câu hỏi" value={q.text} onChange={e => setQ({ ...q, text: e.target.value })} />

      {q.type === "MCQ" && <div className="grid md:grid-cols-2 gap-2 mt-3">
        {opts.map((v, i) => <label key={i} className="flex gap-2 items-center">
          <input type="radio" name="correct" checked={correct === i} onChange={() => setCorrect(i)} />
          <input className="input" placeholder={`Đáp án ${String.fromCharCode(65 + i)}`} value={v} onChange={e => setOpts(opts.map((x, j) => j === i ? e.target.value : x))} />
        </label>)}
      </div>}

      {q.type === "TRUE_FALSE" && <div className="grid grid-cols-2 gap-3 mt-3">
        {opts.slice(0, 2).map((v, i) => <label key={i} className={`border rounded-xl p-3 cursor-pointer ${correct === i ? "border-[#8fb3d3] bg-[#edf5fc]" : "border-slate-200"}`}>
          <div className="flex items-center gap-2"><input type="radio" name="tf-correct" checked={correct === i} onChange={() => setCorrect(i)} /><span className="font-semibold">{v}</span></div>
        </label>)}
      </div>}

      {q.type === "SHORT_ANSWER" && <div className="mt-3">
        <label className="text-xs font-semibold text-slate-500">Đáp án chuẩn</label>
        <input className="input mt-1" placeholder="Có thể nhập nhiều đáp án, ngăn bằng |" value={q.answerKey} onChange={e => setQ({ ...q, answerKey: e.target.value })} />
        <p className="text-xs text-slate-400 mt-1">Học sinh nhập đúng đáp án sẽ được tự động chấm.</p>
      </div>}

      <input className="input mt-3" placeholder="Giải thích / hướng dẫn chấm (không bắt buộc)" value={q.explanation} onChange={e => setQ({ ...q, explanation: e.target.value })} />
      <button disabled={busy} className="btn btn-primary mt-3" onClick={add}>{busy ? "Đang lưu…" : "Lưu vào ngân hàng"}</button>
    </section>

    <section className="card p-5 mt-5">
      <h2 className="font-bold text-lg">Ngân hàng hiện tại · {questions.length} câu</h2>
      <div className="overflow-x-auto mt-4">
        <table className="w-full text-sm min-w-[820px]">
          <thead className="bg-slate-50"><tr><th className="text-left p-3">Câu hỏi</th><th className="text-left p-3">Môn</th><th className="text-left p-3">Dạng</th><th className="text-left p-3">Mức độ</th><th className="text-right p-3">Điểm</th></tr></thead>
          <tbody>{questions.map(x => <tr key={x.id} className="border-t border-slate-100"><td className="p-3 max-w-xl">{x.text}</td><td className="p-3">{x.courseId ? "Theo khóa học" : "Dùng chung"}</td><td className="p-3">{typeText[x.type]}</td><td className="p-3">{x.difficulty}</td><td className="p-3 text-right">{x.points}</td></tr>)}</tbody>
        </table>
      </div>
    </section>
  </div>;
}
