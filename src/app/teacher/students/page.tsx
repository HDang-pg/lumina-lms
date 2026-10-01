import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/guards";
import { Role } from "@prisma/client";
import StudentManager from "./StudentManager";

export default async function StudentsPage() {
  const s = await requireRole(Role.TEACHER);
  const [students, courses] = await Promise.all([
    prisma.user.findMany({
      where: { role: Role.STUDENT, OR: [{ createdByTeacherId: s.id }, { enrollments: { some: { course: { teacherId: s.id } } } }] },
      include: { enrollments: { where: { course: { teacherId: s.id } }, include: { course: { select: { id: true, title: true } } } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.course.findMany({ where: { teacherId: s.id }, select: { id: true, title: true }, orderBy: { createdAt: "desc" } }),
  ]);
  return <div className="container-page fade-in"><div className="mb-7"><div className="text-sm text-slate-500">Teacher workspace</div><h1 className="text-3xl font-bold mt-1">Học sinh & lớp</h1><p className="text-slate-500 mt-2">Tạo tài khoản học sinh, quản lý lớp, tuổi và quyền xem từng khóa học. Học sinh chỉ nhìn thấy khóa học đã được cấp quyền.</p></div><StudentManager initialStudents={students as any} courses={courses}/></div>;
}
