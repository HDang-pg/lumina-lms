import { PrismaClient, Difficulty, QuestionType, VideoType } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const teacher = await prisma.user.findFirst({
    where: { role: "TEACHER" },
    orderBy: { createdAt: "asc" },
  });

  if (!teacher) {
    console.log("Chưa có tài khoản giáo viên; bỏ qua sửa dữ liệu demo.");
    return;
  }

  const course = await prisma.course.findFirst({
    where: { teacherId: teacher.id, slug: "vat-ly-12-hoc-ky-1" },
    select: { id: true, title: true },
  });

  if (course) {
    const cleaned = await prisma.lesson.updateMany({
      where: { courseId: course.id, videoUrl: { contains: "dQw4w9WgXcQ" } },
      data: { videoUrl: null, videoType: VideoType.EMBED, videoDownloadAllowed: false },
    });
    if (cleaned.count) console.log(`Đã gỡ ${cleaned.count} video Rickroll khỏi dữ liệu demo.`);

    const q4 = await prisma.question.upsert({
      where: { id: "seed-q4" },
      update: {},
      create: {
        id: "seed-q4",
        teacherId: teacher.id,
        courseId: course.id,
        topic: "Nhiệt học",
        difficulty: Difficulty.THONG_HIEU,
        type: QuestionType.TRUE_FALSE,
        text: "Trong quá trình đẳng tích, nếu nhiệt độ tăng thì áp suất của khí tăng.",
        points: 1,
        options: {
          create: [
            { text: "Đúng", isCorrect: true, sortOrder: 1 },
            { text: "Sai", isCorrect: false, sortOrder: 2 },
          ],
        },
      },
    });

    const q5 = await prisma.question.upsert({
      where: { id: "seed-q5" },
      update: {},
      create: {
        id: "seed-q5",
        teacherId: teacher.id,
        courseId: course.id,
        topic: "Nhiệt học",
        difficulty: Difficulty.VAN_DUNG,
        type: QuestionType.SHORT_ANSWER,
        text: "Một vật thu vào 4200 J, khối lượng 2 kg, nhiệt dung riêng 2100 J/(kg·K). Độ tăng nhiệt độ là bao nhiêu K?",
        points: 1,
        answerKey: "1",
      },
    });

    const exam = await prisma.exam.findFirst({
      where: { teacherId: teacher.id, title: "Quiz nhanh · Nhiệt học" },
      select: { id: true, subject: true },
    });

    if (exam) {
      if (!exam.subject) await prisma.exam.update({ where: { id: exam.id }, data: { subject: course.title } });
      for (const [questionId, sortOrder] of [[q4.id, 4], [q5.id, 5]] as const) {
        await prisma.examQuestion.upsert({
          where: { examId_questionId: { examId: exam.id, questionId } },
          update: { sortOrder },
          create: { examId: exam.id, questionId, sortOrder },
        });
      }
    }
  }

  await prisma.exam.updateMany({
    where: { teacherId: teacher.id, subject: "" },
    data: { subject: course?.title || "Môn học" },
  });

  console.log("Đã hoàn tất sửa dữ liệu tương thích Lumina LMS v4.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
