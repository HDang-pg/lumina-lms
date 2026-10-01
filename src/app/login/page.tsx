"use client";

import { useState } from "react";
import { BookOpen, Eye, EyeOff, GraduationCap, Trophy, Target } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
      const data = await r.json();
      if (!r.ok) setError(data.error || "Đăng nhập thất bại");
      else window.location.href = data.redirect;
    } catch {
      setError("Không thể kết nối tới hệ thống.");
    } finally {
      setLoading(false);
    }
  }

  return <main className="min-h-screen grid lg:grid-cols-2 bg-white">
    <section className="hidden lg:flex flex-col justify-center p-16 bg-[#edf5fc] border-r border-slate-200">
      <div className="max-w-md mx-auto">
        <div className="flex items-center gap-3 mb-10"><div className="w-11 h-11 rounded-2xl bg-[#4f7cac] text-white grid place-items-center"><BookOpen size={22}/></div><div><div className="font-bold text-xl">Lumina LMS</div><div className="text-sm text-slate-500">Learn • Practice • Progress</div></div></div>
        <h1 className="text-5xl font-black tracking-tight leading-tight">10 điểm Toán là dễ.</h1>
        <p className="mt-5 text-slate-600 leading-7">Chia mục tiêu thành từng chuyên đề, luyện đúng chỗ và biến mỗi điểm số tốt thành thêm một bước tiến.</p>
        <div className="grid gap-3 mt-8">
          <div className="card p-4 flex gap-3"><Trophy className="text-[#4f7cac]"/><div><b>Chinh phục điểm cao môn Toán</b><div className="text-sm text-slate-500">Luyện từ nền tảng đến vận dụng, theo dõi từng bước để tiến gần mục tiêu điểm cao.</div></div></div>
          <div className="card p-4 flex gap-3"><Target className="text-[#4f7cac]"/><div><b>Học đều, tăng điểm đều</b><div className="text-sm text-slate-500">Mỗi bài hoàn thành, mỗi lần sửa lỗi và mỗi lần luyện đề đều tích lũy thành tiến bộ.</div></div></div>
        </div>
      </div>
    </section>
    <section className="flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-md fade-in">
        <div className="mb-8"><div className="lg:hidden flex items-center gap-3 mb-8"><div className="w-10 h-10 rounded-xl bg-[#4f7cac] text-white grid place-items-center"><BookOpen size={20}/></div><b className="text-xl">Lumina LMS</b></div><h2 className="text-3xl font-bold">Đăng nhập</h2><p className="text-slate-500 mt-2">Truy cập đúng không gian theo vai trò của bạn.</p></div>
        {error && <div className="p-3 mb-4 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>}
        <label className="block text-sm font-semibold mb-2">Email</label><input className="input mb-4" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username" placeholder="Nhập email"/>
        <label className="block text-sm font-semibold mb-2">Mật khẩu</label><div className="relative"><input type={showPassword ? "text" : "password"} className="input pr-11" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" placeholder="Nhập mật khẩu"/><button type="button" aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"} onClick={()=>setShowPassword(!showPassword)} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700">{showPassword ? <EyeOff size={19}/> : <Eye size={19}/>}</button></div>
        <button disabled={loading} className="btn btn-primary w-full mt-6">{loading ? "Đang xác thực…" : "Đăng nhập"}</button>
        <div className="mt-6 p-4 rounded-xl bg-[#edf5fc] text-sm text-slate-600 flex gap-3"><GraduationCap className="text-[#4f7cac] shrink-0"/><div><b className="text-slate-800">Học tập có mục tiêu</b><div className="mt-1">Giáo viên quản lý quyền truy cập và lộ trình; học sinh tập trung vào việc học và cải thiện kết quả.</div></div></div>
      </form>
    </section>
  </main>;
}
