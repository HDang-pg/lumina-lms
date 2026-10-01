"use client";

import { useMemo, useState } from "react";

function csrf() {
  return document.cookie.split(";").map(x => x.trim()).find(x => x.startsWith("lms_csrf="))?.split("=")[1] || "";
}

function localDateTimeToISO(value: string) {
  const d = new Date(value);
  return d.toISOString();
}

function viTime(value: string | Date) {
  return new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
}

type Course = { id: string; title: string };
type Question = {
  id: string;
  courseId: string | null;
  text: string;
  topic: string;
  difficulty: string;
  type: string;
  points: number;
};
type Exam = {
  id: string;
  title: string;
  subject?: string;
  category: string;
  durationMin: number;
  openAt: string | Date;
  closeAt: string | Date;
  published: boolean;
};

const typeLabel: Record<string, string> = {
  MCQ: "Trắc nghiệm",
  TRUE_FALSE: "Đúng / Sai",
  SHORT_ANSWER: "Trả lời ngắn",
  ESSAY: "Tự luận",
};

const categoryLabel: Record<string, string> = {
  PRACTICE: "Luyện tập",
  QUIZ: "Quiz / thường xuyên",
  MIDTERM: "Giữa kỳ",
  FINAL: "Cuối kỳ",
};

export default function ExamManager({
  courses,
  questions,
  initial,
}: {
  courses: Course[];
  questions: Question[];
  initial: Exam[];
}) {
  const [exams, setExams] = useState(initial);
  const [courseId, setCourseId] = useState(courses[0]?.id || "");
  const [subject, setSubject] = useState(courses[0]?.title || "");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("QUIZ");
  const [openAt, setOpenAt] = useState("");
  const [closeAt, setCloseAt] = useState("");
  const [durationMin, setDurationMin] = useState(20);
  const [weight, setWeight] = useState(1);
  const [mixQuestions, setMixQuestions] = useState(true);
  const [mixOptions, setMixOptions] = useState(true);
  const [showResult, setShowResult] = useState(true);
  const [busy, setBusy] = useState(false);

  const matching = useMemo(
    () => questions.filter(q => !q.courseId || q.courseId === courseId),
    [questions, courseId]
  );
  const [selected, setSelected] = useState<string[]>(() =>
    matching.slice(0, 5).map(q => q.id)
  );

  function changeCourse(id: string) {
    setCourseId(id);
    setSubject(courses.find(c => c.id === id)?.title || "");
    setSelected(questions.filter(q => !q.courseId || q.courseId === id).slice(0, 5).map(q => q.id));
  }

  async function create() {
    if (!courseId || !subject.trim() || !title.trim() || !openAt || !closeAt) {
      return alert("Hãy chọn môn, nhập tên đề và thời gian mở/đóng.");
    }
    if (durationMin < 1 || durationMin > 10080) {
      return alert("Thời lượng phải từ 1 đến 10080 phút.");
    }
    if (!selected.length) return alert("Chọn ít nhất một câu hỏi.");

    let openISO = "";
    let closeISO = "";
    try {
      openISO = localDateTimeToISO(openAt);
      closeISO = localDateTimeToISO(closeAt);
    } catch {
      return alert("Thời gian mở/đóng không hợp lệ.");
    }

    setBusy(true);
    const r = await fetch("/api/exams", {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": csrf() },
      body: JSON.stringify({
        courseId,
        subject: subject.trim(),
        title: title.trim(),
        category,
        openAt: openISO,
        closeAt: closeISO,
        durationMin: Number(durationMin),
        weight: Number(weight),
        mixQuestions,
        mixOptions,
        showResultImmediately: showResult,
        published: true,
        questionIds: selected,
      }),
    });
    const d = await r.json();
    if (r.ok) {
      setExams([d.exam, ...exams]);
      setTitle("");
      setOpenAt("");
      setCloseAt("");
    } else {
      alert(d.error || "Không thể tạo đề.");
    }
    setBusy(false);
  }

  return (
    <div>
      <section className="card p-5">
        <h2 className="font-bold text-lg">Tạo đề thi</h2>
        <p className="text-sm text-slate-500 mt-1">
          Môn thi có thể tự đặt tên riêng, không bắt buộc trùng tên khóa học. Thời lượng và mốc mở/đóng hoàn toàn tùy giáo viên.
        </p>

        <div className="grid md:grid-cols-2 gap-3 mt-4">
          <div>
            <label className="text-xs font-semibold text-slate-500">Khóa học được cấp quyền</label>
            <select className="input mt-1" value={courseId} onChange={e => changeCourse(e.target.value)}>
              {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">Môn thi</label>
            <input className="input mt-1" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Ví dụ: Toán 12" />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-semibold text-slate-500">Tên kỳ kiểm tra</label>
            <input className="input mt-1" placeholder="Ví dụ: Kiểm tra chương 1" value={title} onChange={e => setTitle(e.target.value)} />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
          <div>
            <label className="text-xs font-semibold text-slate-500">Loại</label>
            <select className="input mt-1" value={category} onChange={e => setCategory(e.target.value)}>
              <option value="PRACTICE">Luyện tập</option>
              <option value="QUIZ">Quiz / thường xuyên</option>
              <option value="MIDTERM">Giữa kỳ</option>
              <option value="FINAL">Cuối kỳ</option>
            </select>
          </div>
          <div><label className="text-xs font-semibold text-slate-500">Mở từ</label><input className="input mt-1" type="datetime-local" value={openAt} onChange={e => setOpenAt(e.target.value)} /></div>
          <div><label className="text-xs font-semibold text-slate-500">Đóng lúc</label><input className="input mt-1" type="datetime-local" value={closeAt} onChange={e => setCloseAt(e.target.value)} /></div>
          <div><label className="text-xs font-semibold text-slate-500">Thời lượng (phút)</label><input className="input mt-1" type="number" min="1" max="10080" value={durationMin} onChange={e => setDurationMin(Number(e.target.value))} /></div>
        </div>

        <div className="grid sm:grid-cols-3 gap-3 mt-3">
          <div><label className="text-xs font-semibold text-slate-500">Trọng số sổ điểm</label><input className="input mt-1" type="number" min="0" max="100" step="0.25" value={weight} onChange={e => setWeight(Number(e.target.value))} /></div>
          <label className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm"><input type="checkbox" checked={mixQuestions} onChange={e => setMixQuestions(e.target.checked)} /> Trộn câu hỏi</label>
          <label className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm"><input type="checkbox" checked={mixOptions} onChange={e => setMixOptions(e.target.checked)} /> Trộn đáp án</label>
        </div>
        <label className="flex items-center gap-2 mt-3 text-sm"><input type="checkbox" checked={showResult} onChange={e => setShowResult(e.target.checked)} /> Cho học sinh xem điểm khách quan ngay sau khi nộp</label>

        <div className="mt-5">
          <div className="font-semibold text-sm mb-2">Câu hỏi · {selected.length} câu đã chọn</div>
          <div className="grid max-h-80 overflow-auto gap-2">
            {matching.map(q => (
              <label key={q.id} className="flex gap-3 border rounded-xl p-3 cursor-pointer hover:bg-slate-50">
                <input type="checkbox" checked={selected.includes(q.id)} onChange={() => setSelected(selected.includes(q.id) ? selected.filter(x => x !== q.id) : [...selected, q.id])} />
                <div className="min-w-0"><div className="text-sm">{q.text}</div><div className="text-xs text-slate-400">{typeLabel[q.type] || q.type} · {q.topic} · {q.difficulty} · {q.points}đ</div></div>
              </label>
            ))}
          </div>
          {!matching.length && <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Môn này chưa có câu hỏi. Hãy tạo câu hỏi trong ngân hàng trước.</div>}
        </div>

        <button disabled={busy} className="btn btn-primary mt-4" onClick={() => void create()}>{busy ? "Đang phát hành…" : "Phát hành đề"}</button>
      </section>

      <section className="card p-5 mt-5">
        <h2 className="font-bold text-lg">Danh sách đề</h2>
        <div className="space-y-3 mt-4">
          {exams.map(e => (
            <div key={e.id} className="rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:justify-between gap-4">
              <div className="min-w-0">
                <div className="font-semibold">{e.subject || "Môn học"} · {e.title}</div>
                <div className="text-xs text-slate-500 mt-1">
                  {categoryLabel[e.category] || e.category} · {e.durationMin} phút · mở {viTime(e.openAt)} · đóng {viTime(e.closeAt)}
                </div>
              </div>
              <span className={`pill ${e.published ? "pill-green" : "pill-gray"}`}>{e.published ? "Đã phát hành" : "Bản nháp"}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
