import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/guards";
import { Role } from "@prisma/client";

function viTime(value: Date) {
  return value.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
}

export default async function Exams() {
  const s = await requireRole(Role.STUDENT);
  const es = await prisma.exam.findMany({
    where: { published: true, course: { enrollments: { some: { studentId: s.id } } } },
    include: { course: true, _count: { select: { questions: true } } },
    orderBy: { openAt: "desc" },
  });
  const now = new Date();

  return (
    <div className="container-page fade-in">
      <h1 className="text-3xl font-bold">Bài kiểm tra</h1>
      <p className="text-slate-500 mt-2">Chỉ đề đã được phát hành và đến thời gian mở mới hiển thị nội dung câu hỏi.</p>
      <div className="grid lg:grid-cols-2 gap-5 mt-6">
        {es.map(e => {
          const live = now >= e.openAt && now <= e.closeAt;
          return (
            <div key={e.id} className="card p-5 hover-lift">
              <div className="flex justify-between gap-4">
                <div className="min-w-0">
                  <span className={`pill ${live ? "pill-green" : now < e.openAt ? "pill-orange" : "pill-gray"}`}>{live ? "Đang mở" : now < e.openAt ? "Chưa mở" : "Đã đóng"}</span>
                  <h2 className="font-bold text-lg mt-3">{e.subject || e.course.title} · {e.title}</h2>
                  <div className="text-sm text-slate-500 mt-1">{e.course.title} · {e._count.questions} câu · {e.durationMin} phút</div>
                </div>
                <div className="text-xs text-right text-slate-400 shrink-0">{e.category}</div>
              </div>
              <div className="text-xs text-slate-400 mt-4">Mở: {viTime(e.openAt)}<br/>Đóng: {viTime(e.closeAt)}</div>
              {live ? <Link href={`/student/exams/${e.id}`} className="btn btn-primary inline-block mt-4">Vào phòng thi</Link> : <button disabled className="btn btn-secondary mt-4">{now < e.openAt ? "Chưa đến giờ" : "Đề đã đóng"}</button>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
