import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/auth";
import { assertCsrf } from "@/lib/csrf";

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  nickname: z.string().trim().max(60).optional().nullable(),
  email: z.string().email().max(120),
  password: z.string().min(6).max(120),
  age: z.number().int().min(5).max(100).nullable().optional(),
  className: z.string().trim().max(80).optional().nullable(),
  courseIds: z.array(z.string()).default([]),
});

const updateSchema = createSchema
  .omit({ password: true })
  .extend({
    id: z.string(),
    password: z.preprocess(
      (v) => (v === "" ? undefined : v),
      z.string().min(6).max(120).optional()
    ),
  });

async function teacherSession(req: Request) {
  const s = await readSession();

  if (!s || s.role !== "TEACHER") {
    return null;
  }

  try {
    await assertCsrf(req);
  } catch {
    throw new Error("CSRF");
  }

  return s;
}

function publicStudent(u: any) {
  return {
    id: u.id,
    name: u.name,
    nickname: u.nickname,
    email: u.email,
    role: u.role,
    avatarUrl: u.avatarUrl,
    age: u.age,
    className: u.className,
    createdAt: u.createdAt,
    enrollments:
      u.enrollments?.map((e: any) => ({
        id: e.id,
        courseId: e.courseId,
        progressPct: e.progressPct,
        course: e.course,
      })) || [],
  };
}

export async function GET() {
  const s = await readSession();

  if (!s || s.role !== "TEACHER") {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const students = await prisma.user.findMany({
    where: {
      role: "STUDENT",
      OR: [
        {
          createdByTeacherId: s.id,
        },
        {
          enrollments: {
            some: {
              course: {
                teacherId: s.id,
              },
            },
          },
        },
      ],
    },
    include: {
      enrollments: {
        where: {
          course: {
            teacherId: s.id,
          },
        },
        include: {
          course: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return NextResponse.json({
    students: students.map(publicStudent),
  });
}

export async function POST(req: Request) {
  let s;

  try {
    s = await teacherSession(req);
  } catch (e: any) {
    return NextResponse.json(
      {
        error:
          e.message === "CSRF"
            ? "CSRF"
            : "Unauthorized",
      },
      { status: 403 }
    );
  }

  if (!s) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const b = createSchema.parse(await req.json());

    const courseIds = [...new Set(b.courseIds)];

    const validCourses = await prisma.course.findMany({
      where: {
        id: {
          in: courseIds,
        },
        teacherId: s.id,
      },
      select: {
        id: true,
      },
    });

    if (validCourses.length !== courseIds.length) {
      return NextResponse.json(
        {
          error:
            "Có khóa học không thuộc quyền quản lý của bạn.",
        },
        { status: 403 }
      );
    }

    const passwordHash = await bcrypt.hash(
      b.password,
      12
    );

    const student = await prisma.$transaction(
      async (tx) => {
        const user = await tx.user.create({
          data: {
            name: b.name,
            nickname: b.nickname || null,
            email: b.email.toLowerCase().trim(),
            passwordHash,
            role: "STUDENT",
            age: b.age ?? null,
            className: b.className || null,
            createdByTeacherId: s!.id,
          },
        });

        if (courseIds.length) {
          await tx.enrollment.createMany({
            data: courseIds.map((courseId) => ({
              studentId: user.id,
              courseId,
            })),
          });
        }

        await tx.notification.create({
          data: {
            userId: user.id,
            title: "Tài khoản học tập đã được tạo",
            body: `Giáo viên ${s!.name} đã tạo tài khoản và cấp ${courseIds.length} khóa học cho bạn.`,
            href: "/dashboard/courses",
          },
        });

        return user;
      }
    );

    const full = await prisma.user.findUnique({
      where: {
        id: student.id,
      },
      include: {
        enrollments: {
          where: {
            course: {
              teacherId: s.id,
            },
          },
          include: {
            course: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(
      {
        ok: true,
        student: publicStudent(full),
      },
      { status: 201 }
    );
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json(
        { error: "Email đã tồn tại." },
        { status: 409 }
      );
    }

    if (e instanceof z.ZodError) {
      return NextResponse.json(
        {
          error:
            "Thông tin học sinh không hợp lệ.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error:
          "Không thể tạo tài khoản học sinh.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  let s;

  try {
    s = await teacherSession(req);
  } catch (e: any) {
    return NextResponse.json(
      {
        error:
          e.message === "CSRF"
            ? "CSRF"
            : "Unauthorized",
      },
      { status: 403 }
    );
  }

  if (!s) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const b = updateSchema.parse(await req.json());

    const existing = await prisma.user.findFirst({
      where: {
        id: b.id,
        role: "STUDENT",
        createdByTeacherId: s.id,
      },
    });

    if (!existing) {
      return NextResponse.json(
        {
          error:
            "Bạn không quản lý tài khoản học sinh này.",
        },
        { status: 403 }
      );
    }

    const courseIds = [...new Set(b.courseIds)];

    const validCourses = await prisma.course.findMany({
      where: {
        id: {
          in: courseIds,
        },
        teacherId: s.id,
      },
      select: {
        id: true,
      },
    });

    if (validCourses.length !== courseIds.length) {
      return NextResponse.json(
        {
          error:
            "Có khóa học không thuộc quyền quản lý của bạn.",
        },
        { status: 403 }
      );
    }

    const data: any = {
      name: b.name,
      nickname: b.nickname || null,
      email: b.email.toLowerCase().trim(),
      age: b.age ?? null,
      className: b.className || null,
    };

    if (b.password) {
      data.passwordHash = await bcrypt.hash(
        b.password,
        12
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: {
          id: b.id,
        },
        data,
      });

      const teacherCourseIds = (
        await tx.course.findMany({
          where: {
            teacherId: s!.id,
          },
          select: {
            id: true,
          },
        })
      ).map((c) => c.id);

      if (teacherCourseIds.length) {
        await tx.enrollment.deleteMany({
          where: {
            studentId: b.id,
            courseId: {
              in: teacherCourseIds,
            },
          },
        });
      }

      if (courseIds.length) {
        await tx.enrollment.createMany({
          data: courseIds.map((courseId) => ({
            studentId: b.id,
            courseId,
          })),
        });
      }

      await tx.notification.create({
        data: {
          userId: b.id,
          title: "Quyền học tập đã được cập nhật",
          body: `Giáo viên ${s!.name} đã cập nhật thông tin lớp, hồ sơ hoặc khóa học được phép truy cập.`,
          href: "/dashboard/courses",
        },
      });
    });

    const full = await prisma.user.findUnique({
      where: {
        id: b.id,
      },
      include: {
        enrollments: {
          where: {
            course: {
              teacherId: s.id,
            },
          },
          include: {
            course: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      student: publicStudent(full),
    });
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json(
        { error: "Email đã tồn tại." },
        { status: 409 }
      );
    }

    if (e instanceof z.ZodError) {
      return NextResponse.json(
        {
          error:
            "Thông tin học sinh không hợp lệ.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error:
          "Không thể cập nhật học sinh.",
      },
      { status: 500 }
    );
  }
}