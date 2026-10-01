"use client";

import { useState } from "react";
import { Eye, EyeOff, Pencil, Plus, Save, ShieldCheck, X } from "lucide-react";

type Course = { id: string; title: string };
type Student = { id: string; name: string; nickname: string | null; email: string; age: number | null; className: string | null; enrollments: { courseId: string; course: Course }[] };
function csrf() { return document.cookie.split(";").map(x => x.trim()).find(x => x.startsWith("lms_csrf="))?.split("=")[1] || ""; }

const emptyForm = { name: "", nickname: "", email: "", password: "", age: "", className: "", courseIds: [] as string[] };

export default function StudentManager({ initialStudents, courses }: { initialStudents: Student[]; courses: Course[] }) {
  const [students, setStudents] = useState(initialStudents);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  function startEdit(s: Student) {
    setEditing(s.id);
    setShowPassword(false);
    setForm({ name: s.name, nickname: s.nickname || "", email: s.email, password: "", age: s.age?.toString() || "", className: s.className || "", courseIds: s.enrollments.map(e => e.courseId) });
    setCreateOpen(false);
  }
  function reset() { setEditing(null); setForm(emptyForm); setCreateOpen(true); setShowPassword(false); }
  function toggleCourse(id: string) { setForm(f => ({ ...f, courseIds: f.courseIds.includes(id) ? f.courseIds.filter(x => x !== id) : [...f.courseIds, id] })); }

  async function save() {
    setBusy(true);
    const method = editing ? "PATCH" : "POST";
    const payload: Record<string, unknown> = { ...form, age: form.age ? Number(form.age) : null };
    if (editing) payload.id = editing;
    const r = await fetch("/api/teacher/students", { method, headers: { "content-type": "application/json", "x-csrf-token": csrf() }, body: JSON.stringify(payload) });
    const d = await r.json();
    if (!r.ok) { alert(d.error || "Không thể lưu"); setBusy(false); return; }
    if (editing) setStudents(students.map(s => s.id === editing ? d.student : s));
    else setStudents([d.student, ...students]);
    reset();
    setBusy(false);
  }

  return <div className="space-y-5">
    <section className="card p-5 border-[#c9dced]">
      <div className="flex items-center justify-between gap-4"><div><h2 className="font-bold text-lg">{editing ? "Chỉnh sửa học sinh" : "Tạo tài khoản học sinh"}</h2><p className="text-sm text-slate-500 mt-1">Chỉ tài khoản giáo viên có quyền thực hiện.</p></div><ShieldCheck className="text-[#4f7cac]"/></div>
      {(createOpen || editing) && <div className="mt-5 grid md:grid-cols-2 xl:grid-cols-3 gap-3">
        <input className="input" placeholder="Họ và tên" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}/>
        <input className="input" placeholder="Nickname" value={form.nickname} onChange={e => setForm({ ...form, nickname: e.target.value })}/>
        <input className="input" type="email" name="student-login-email" autoComplete="off" placeholder="Tên đăng nhập / email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}/>
        <div className="relative"><input className="input pr-11" type={showPassword ? "text" : "password"} placeholder={editing ? "Mật khẩu mới (để trống nếu giữ nguyên)" : "Mật khẩu"} autoComplete="new-password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}/><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700" aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div>
        <input className="input" type="number" min="5" max="100" placeholder="Tuổi" value={form.age} onChange={e => setForm({ ...form, age: e.target.value })}/>
        <input className="input" placeholder="Lớp (VD: 12A1)" value={form.className} onChange={e => setForm({ ...form, className: e.target.value })}/>
        <div className="md:col-span-2 xl:col-span-3 rounded-2xl bg-slate-50 p-4"><div className="font-semibold text-sm">Khóa học được phép xem</div><div className="text-xs text-slate-400 mt-1">Chỉ những khóa học được chọn mới xuất hiện với học sinh.</div><div className="flex flex-wrap gap-2 mt-3">{courses.map(c => <button type="button" key={c.id} onClick={() => toggleCourse(c.id)} className={`px-3 py-2 rounded-xl text-sm border transition ${form.courseIds.includes(c.id) ? "bg-[#edf5fc] border-[#8fb3d3] text-[#3f6790] font-semibold" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}`}>{form.courseIds.includes(c.id) ? "✓ " : ""}{c.title}</button>)}</div></div>
        <div className="md:col-span-2 xl:col-span-3 flex gap-2"><button disabled={busy} onClick={() => void save()} className="btn btn-primary flex items-center gap-2"><Save size={16}/>{busy ? "Đang lưu…" : editing ? "Lưu thay đổi" : "Tạo tài khoản"}</button>{editing && <button onClick={reset} className="btn btn-secondary flex items-center gap-2"><X size={16}/> Hủy</button>}</div>
      </div>}
    </section>

    <section className="card p-5"><div className="flex items-center justify-between mb-4"><div><h2 className="font-bold text-lg">Danh sách học sinh</h2><p className="text-sm text-slate-500">{students.length} tài khoản đang được quản lý.</p></div>{!editing && <button onClick={() => { setCreateOpen(!createOpen); setShowPassword(false); }} className="btn btn-secondary flex items-center gap-2"><Plus size={16}/> Tài khoản mới</button>}</div>
      <div className="space-y-3">{students.map(s => <div key={s.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4"><div className="min-w-0"><div className="flex items-center gap-2"><div className="font-bold truncate">{s.name}</div>{s.nickname && <span className="pill pill-blue">@{s.nickname}</span>}</div><div className="text-sm text-slate-500 mt-1">{s.email} · {s.className || "Chưa xếp lớp"} · {s.age ? `${s.age} tuổi` : "Chưa nhập tuổi"}</div><div className="flex flex-wrap gap-2 mt-3">{s.enrollments.map(e => <span className="pill pill-gray" key={e.courseId}>{e.course.title}</span>)}{!s.enrollments.length && <span className="pill pill-orange">Chưa cấp khóa học</span>}</div></div><button onClick={() => startEdit(s)} className="btn btn-secondary flex items-center justify-center gap-2"><Pencil size={15}/> Chỉnh sửa</button></div></div>)}{!students.length && <div className="text-sm text-slate-400 py-6 text-center">Chưa có học sinh. Hãy tạo tài khoản đầu tiên.</div>}</div>
    </section>
  </div>;
}
