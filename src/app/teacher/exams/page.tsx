import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/guards";
import { Role } from "@prisma/client";
import ExamManager from "./ExamManager";

export default async function Exams() {
  const s = await requireRole(Role.TEACHER);
  const [courses, questions, exams] = await Promise.all([
    prisma.course.findMany({
      where: { teacherId: s.id },
      select: { id: true, title: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.question.findMany({
      where: { teacherId: s.id },
      select: { id: true, text: true, topic: true, difficulty: true, points: true, courseId: true, type: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.exam.findMany({
      where: { teacherId: s.id },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="container-page fade-in">
      <div className="mb-7">
        <div className="text-sm text-slate-500">Teacher workspace</div>
        <h1 className="text-3xl font-bold mt-1">Đề thi & phòng thi</h1>
        <p className="text-slate-500 mt-2">
          Tự chọn môn thi, loại câu hỏi, thời gian mở/đóng và thời lượng cho từng kỳ kiểm tra.
        </p>
      </div>
      <ExamManager courses={courses} questions={questions} initial={exams} />
    </div>
  );
}
