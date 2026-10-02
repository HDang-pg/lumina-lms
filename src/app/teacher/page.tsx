import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/guards";
import { Role } from "@prisma/client";
import { StatCard } from "@/components/StatCard";
import {
  Users,
  FileQuestion,
  ClipboardCheck,
  BookOpen,
} from "lucide-react";

export default async function TeacherHome() {
  const s = await requireRole(Role.TEACHER);

  const result = await prisma.$queryRaw<
    {
      courses: bigint;
      students: bigint;
      questions: bigint;
      attempts: bigint;
      essay: bigint;
    }[]
  >`
    SELECT
      (
        SELECT COUNT(*)
        FROM "Course"
        WHERE "teacherId" = ${s.id}
      ) AS courses,

      (
        SELECT COUNT(*)
        FROM "Enrollment" e
        INNER JOIN "Course" c ON c.id = e."courseId"
        WHERE c."teacherId" = ${s.id}
      ) AS students,

      (
        SELECT COUNT(*)
        FROM "Question"
        WHERE "teacherId" = ${s.id}
      ) AS questions,

      (
        SELECT COUNT(*)
        FROM "Attempt" a
        INNER JOIN "Exam" e ON e.id = a."examId"
        WHERE e."teacherId" = ${s.id}
      ) AS attempts,

      (
        SELECT COUNT(*)
        FROM "Answer" a
        INNER JOIN "Question" q ON q.id = a."questionId"
        WHERE a."graded" = false
          AND q."teacherId" = ${s.id}
          AND q."type" = 'ESSAY'
      ) AS essay
  `;

  const stats = result[0];

  const courses = Number(stats.courses);
  const students = Number(stats.students);
  const questions = Number(stats.questions);
  const attempts = Number(stats.attempts);
  const essay = Number(stats.essay);

  return (
    <div className="container-page fade-in">
      <div className="mb-7">
        <div className="text-sm text-slate-500">Teacher workspace</div>
        <h1 className="text-3xl font-bold mt-1">
          Bảng điều khiển giảng dạy
        </h1>
        <p className="text-slate-500 mt-2">
          Quản lý nội dung, kiểm tra và theo dõi chất lượng học tập trong một chỗ.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Khóa học" value={courses} />
        <StatCard label="Học sinh" value={students} />
        <StatCard label="Ngân hàng câu hỏi" value={questions} />
        <StatCard label="Bài đã nộp" value={attempts} />
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-5 gap-4 mt-6">
        <Link
          className="card p-5 hover-lift"
          href="/teacher/courses"
        >
          <BookOpen className="text-[#4f7cac]" />
          <div className="font-bold mt-4">Khóa học & video</div>
          <div className="text-sm text-slate-500 mt-1">
            Tạo bài giảng, bật/tắt tải xuống.
          </div>
        </Link>

        <Link
          className="card p-5 hover-lift"
          href="/teacher/students"
        >
          <Users className="text-[#4f7cac]" />
          <div className="font-bold mt-4">Học sinh & lớp</div>
          <div className="text-sm text-slate-500 mt-1">
            Tạo tài khoản, xếp lớp và cấp quyền khóa học.
          </div>
        </Link>

        <Link
          className="card p-5 hover-lift"
          href="/teacher/questions"
        >
          <FileQuestion className="text-[#4f7cac]" />
          <div className="font-bold mt-4">Ngân hàng câu hỏi</div>
          <div className="text-sm text-slate-500 mt-1">
            Chủ đề, mức độ, đáp án.
          </div>
        </Link>

        <Link
          className="card p-5 hover-lift"
          href="/teacher/exams"
        >
          <ClipboardCheck className="text-[#4f7cac]" />
          <div className="font-bold mt-4">Ra đề & phòng thi</div>
          <div className="text-sm text-slate-500 mt-1">
            Lịch mở, thời lượng, trộn mã đề.
          </div>
        </Link>

        <Link
          className="card p-5 hover-lift"
          href="/teacher/grading"
        >
          <Users className="text-[#4f7cac]" />
          <div className="font-bold mt-4">Chấm tự luận</div>
          <div className="text-sm text-slate-500 mt-1">
            {essay} câu đang chờ chấm.
          </div>
        </Link>
      </div>

      <section className="card mt-6 p-5">
        <h2 className="font-bold text-lg">Nguyên tắc vận hành</h2>

        <div className="grid md:grid-cols-3 gap-4 mt-4 text-sm">
          <div className="p-4 rounded-xl bg-slate-50">
            <b>Server là nguồn tin cậy</b>
            <p className="text-slate-500 mt-1">
              Không đưa đáp án đúng hay đề chưa mở vào HTML.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50">
            <b>Kiểm tra quyền ở API</b>
            <p className="text-slate-500 mt-1">
              Không chỉ ẩn nút; request trái quyền bị từ chối.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50">
            <b>DB có index</b>
            <p className="text-slate-500 mt-1">
              Các truy vấn theo teacher/course/exam/student được lập index.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}