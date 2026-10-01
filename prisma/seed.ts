import { PrismaClient, Role, QuestionType, Difficulty, ExamCategory, VideoType } from "@prisma/client";
import bcrypt from "bcryptjs";
const prisma = new PrismaClient();
async function main() {
  const passwordHash = await bcrypt.hash("Demo@12345", 12);
  const teacher = await prisma.user.upsert({
    where: { email: "teacher@lumina.local" },
    update: { name: "Nguyễn Minh An", nickname: "Thầy An", passwordHash, role: Role.TEACHER, age: 32 },
    create: { name: "Nguyễn Minh An", nickname: "Thầy An", email: "teacher@lumina.local", passwordHash, role: Role.TEACHER, age: 32 }
  });
  const student = await prisma.user.upsert({
    where: { email: "student@lumina.local" },
    update: { name: "Trần Hải Nam", nickname: "Nam", passwordHash, role: Role.STUDENT, age: 17, className: "12A1", createdByTeacherId: teacher.id },
    create: { name: "Trần Hải Nam", nickname: "Nam", email: "student@lumina.local", passwordHash, role: Role.STUDENT, age: 17, className: "12A1", createdByTeacherId: teacher.id }
  });
  let course = await prisma.course.findUnique({ where: { slug: "vat-ly-12-hoc-ky-1" } });
  if (!course) {
    course = await prisma.course.create({
      data: {
        title: "Vật lý 12 — HK I", slug: "vat-ly-12-hoc-ky-1",
        description: "Lộ trình củng cố nền tảng, luyện vận dụng và theo dõi tiến độ theo từng chuyên đề.",
        teacherId: teacher.id, thumbnail: "", courseDownloadAllowed: false,
        lessons: { create: [
          { title: "Bài 1. Nhiệt lượng và nhiệt dung riêng", chapter: "Chương 1 · Nhiệt học", description: "Phân tích công thức Q = mcΔT và cách biến đổi đại lượng.", videoType: VideoType.EMBED, videoUrl: null, videoDownloadAllowed: false, sortOrder: 1 },
          { title: "Bài 2. Phương trình trạng thái khí", chapter: "Chương 2 · Chất khí", description: "Mối liên hệ giữa p, V, T trong các quá trình cơ bản.", videoType: VideoType.EMBED, videoUrl: null, videoDownloadAllowed: false, sortOrder: 2 },
          { title: "Bài 3. Ôn tập chuyên đề", chapter: "Chương 2 · Chất khí", description: "Bộ câu hỏi luyện tập theo 4 mức độ nhận thức.", videoType: VideoType.EMBED, videoUrl: null, videoDownloadAllowed: false, sortOrder: 3 }
        ]}
      }
    });
  }
  await prisma.enrollment.upsert({ where: { studentId_courseId: { studentId: student.id, courseId: course.id } }, update: { progressPct: 63 }, create: { studentId: student.id, courseId: course.id, progressPct: 63 } });
  await prisma.lesson.updateMany({ where: { courseId: course.id, videoUrl: { contains: "dQw4w9WgXcQ" } }, data: { videoUrl: null, videoType: VideoType.EMBED, videoDownloadAllowed: false } });
  const lessons = await prisma.lesson.findMany({ where: { courseId: course.id }, orderBy: { sortOrder: "asc" } });
  for (const lesson of lessons) {
    await prisma.lessonProgress.upsert({ where: { studentId_lessonId: { studentId: student.id, lessonId: lesson.id } }, update: { completed: lesson.sortOrder < 3, watchedSec: lesson.sortOrder < 3 ? 900 : 240 }, create: { studentId: student.id, lessonId: lesson.id, completed: lesson.sortOrder < 3, watchedSec: lesson.sortOrder < 3 ? 900 : 240 } });
  }
  const q1 = await prisma.question.upsert({
    where: { id: "seed-q1" }, update: {},
    create: { id: "seed-q1", teacherId: teacher.id, courseId: course.id, topic: "Nhiệt học", difficulty: Difficulty.NHAN_BIET, type: QuestionType.MCQ, text: "Công thức tính nhiệt lượng vật thu vào khi không có chuyển thể là gì?", points: 1,
      options: { create: [
        { text: "Q = mcΔT", isCorrect: true, sortOrder: 1 }, { text: "Q = m/cΔT", isCorrect: false, sortOrder: 2 }, { text: "Q = c/(mΔT)", isCorrect: false, sortOrder: 3 }, { text: "Q = mc/ΔT", isCorrect: false, sortOrder: 4 }
      ] }
    }
  });
  const q2 = await prisma.question.upsert({
    where: { id: "seed-q2" }, update: {},
    create: { id: "seed-q2", teacherId: teacher.id, courseId: course.id, topic: "Nhiệt học", difficulty: Difficulty.THONG_HIEU, type: QuestionType.MCQ, text: "Nếu ΔT = 0 thì nhiệt lượng theo công thức Q = mcΔT bằng bao nhiêu?", points: 1,
      options: { create: [
        { text: "0", isCorrect: true, sortOrder: 1 }, { text: "m", isCorrect: false, sortOrder: 2 }, { text: "c", isCorrect: false, sortOrder: 3 }, { text: "Không xác định", isCorrect: false, sortOrder: 4 }
      ] }
    }
  });
  const q3 = await prisma.question.upsert({
    where: { id: "seed-q3" }, update: {},
    create: { id: "seed-q3", teacherId: teacher.id, courseId: course.id, topic: "Chất khí", difficulty: Difficulty.VAN_DUNG, type: QuestionType.ESSAY, text: "Giải thích bằng lời vì sao tăng nhiệt độ của một lượng khí kín ở thể tích không đổi làm áp suất tăng.", points: 2 }
  });
  const q4 = await prisma.question.upsert({
    where: { id: "seed-q4" }, update: {},
    create: { id: "seed-q4", teacherId: teacher.id, courseId: course.id, topic: "Nhiệt học", difficulty: Difficulty.THONG_HIEU, type: QuestionType.TRUE_FALSE, text: "Trong quá trình đẳng tích, nếu nhiệt độ tăng thì áp suất của khí tăng.", points: 1,
      options: { create: [
        { text: "Đúng", isCorrect: true, sortOrder: 1 }, { text: "Sai", isCorrect: false, sortOrder: 2 }
      ] }
    }
  });
  const q5 = await prisma.question.upsert({
    where: { id: "seed-q5" }, update: {},
    create: { id: "seed-q5", teacherId: teacher.id, courseId: course.id, topic: "Nhiệt học", difficulty: Difficulty.VAN_DUNG, type: QuestionType.SHORT_ANSWER, text: "Một vật thu vào 4200 J, khối lượng 2 kg, nhiệt dung riêng 2100 J/(kg·K). Độ tăng nhiệt độ là bao nhiêu K?", points: 1, answerKey: "1" }
  });
  let exam = await prisma.exam.findFirst({ where: { teacherId: teacher.id, title: "Quiz nhanh · Nhiệt học" } });
  if (!exam) {
    const now = new Date();
    exam = await prisma.exam.create({
      data: { teacherId: teacher.id, courseId: course.id, title: "Quiz nhanh · Nhiệt học", subject: "Vật lý 12", category: ExamCategory.QUIZ,
        openAt: new Date(now.getTime() - 30 * 60 * 1000), closeAt: new Date(now.getTime() + 24 * 60 * 60 * 1000), durationMin: 20,
        published: true, mixQuestions: true, mixOptions: true, showResultImmediately: true, weight: 1,
        questions: { create: [{ questionId: q1.id, sortOrder: 1 }, { questionId: q2.id, sortOrder: 2 }, { questionId: q3.id, sortOrder: 3 }] }
      }
    });
  } else if (!exam.subject) {
    exam = await prisma.exam.update({ where: { id: exam.id }, data: { subject: "Vật lý 12" } });
  }
  for (const [questionId, sortOrder] of [[q1.id, 1], [q2.id, 2], [q3.id, 3], [q4.id, 4], [q5.id, 5]] as const) {
    await prisma.examQuestion.upsert({ where: { examId_questionId: { examId: exam.id, questionId } }, update: { sortOrder }, create: { examId: exam.id, questionId, sortOrder } });
  }
  await prisma.gamification.upsert({ where: { studentId: student.id }, update: { points: 360, streak: 7, lastStudyAt: new Date() }, create: { studentId: student.id, points: 360, streak: 7, lastStudyAt: new Date() } });
  await prisma.studentBadge.upsert({ where: { studentId_code: { studentId: student.id, code: "STREAK_3" } }, update: {}, create: { studentId: student.id, code: "STREAK_3" } });
  await prisma.studentBadge.upsert({ where: { studentId_code: { studentId: student.id, code: "FIRST_ASSIGNMENT" } }, update: {}, create: { studentId: student.id, code: "FIRST_ASSIGNMENT" } });
  await prisma.notification.upsert({
    where: { id: "seed-notif-student" }, update: { userId: student.id, title: "Quiz mới đã mở", body: "Quiz nhanh · Nhiệt học đang mở và còn 24 giờ.", href: exam ? `/student/exams/${exam.id}` : null },
    create: { id: "seed-notif-student", userId: student.id, title: "Quiz mới đã mở", body: "Quiz nhanh · Nhiệt học đang mở và còn 24 giờ.", href: exam ? `/student/exams/${exam.id}` : null }
  });
  const latestAttempt = await prisma.attempt.findFirst({
    where: { examId: exam.id, status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] } },
    orderBy: { submittedAt: "desc" },
    select: { id: true, student: { select: { name: true } } },
  });
  await prisma.notification.upsert({
    where: { id: "seed-notif-teacher" },
    update: {
      userId: teacher.id,
      title: "Có bài nộp mới",
      body: latestAttempt ? `${latestAttempt.student.name} đã hoàn thành bài kiểm tra gần nhất.` : "Chưa có bài nộp mẫu; thông báo này sẽ dẫn đến hàng chờ chấm.",
      href: latestAttempt ? `/teacher/grading?attemptId=${latestAttempt.id}` : "/teacher/grading"
    },
    create: {
      id: "seed-notif-teacher",
      userId: teacher.id,
      title: "Có bài nộp mới",
      body: latestAttempt ? `${latestAttempt.student.name} đã hoàn thành bài kiểm tra gần nhất.` : "Chưa có bài nộp mẫu; thông báo này sẽ dẫn đến hàng chờ chấm.",
      href: latestAttempt ? `/teacher/grading?attemptId=${latestAttempt.id}` : "/teacher/grading"
    }
  });
  console.log("Teacher demo: teacher@lumina.local / Demo@12345");
  console.log("Student demo: student@lumina.local / Demo@12345");
}
main().finally(() => prisma.$disconnect());
