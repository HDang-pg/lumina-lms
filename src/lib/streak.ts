import { prisma } from "@/lib/prisma";

const VIETNAM_TIMEZONE = "Asia/Ho_Chi_Minh";

function getVietnamDateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: VIETNAM_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function dateKeyToUtc(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

export async function recordStudyActivity(
  studentId: string,
  now = new Date()
) {
  const game = await prisma.gamification.findUnique({
    where: {
      studentId,
    },
  });

  if (!game || !game.lastStudyAt) {
    return prisma.gamification.upsert({
      where: {
        studentId,
      },
      update: {
        streak: 1,
        lastStudyAt: now,
      },
      create: {
        studentId,
        streak: 1,
        lastStudyAt: now,
      },
    });
  }

  const lastKey = getVietnamDateKey(game.lastStudyAt);
  const todayKey = getVietnamDateKey(now);

  const diffDays = Math.floor(
    (dateKeyToUtc(todayKey) - dateKeyToUtc(lastKey)) /
      (24 * 60 * 60 * 1000)
  );

  if (diffDays === 0) {
    return game;
  }

  if (diffDays === 1) {
    return prisma.gamification.update({
      where: {
        studentId,
      },
      data: {
        streak: {
          increment: 1,
        },
        lastStudyAt: now,
      },
    });
  }

  return prisma.gamification.update({
    where: {
      studentId,
    },
    data: {
      streak: 1,
      lastStudyAt: now,
    },
  });
}