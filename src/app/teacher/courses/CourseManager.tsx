"use client";

import { useState } from "react";
import { Check, Link as LinkIcon, Trash2, Upload, Video } from "lucide-react";

type Attachment = {
  id: string;
  name: string;
};

type Lesson = {
  id: string;
  title: string;
  chapter: string;
  description: string;
  videoType: "LOCAL" | "EMBED";
  videoUrl: string | null;
  videoDownloadAllowed: boolean;
  attachments?: Attachment[];
};

type Course = {
  id: string;
  title: string;
  description: string;
  courseDownloadAllowed: boolean;
  lessons: Lesson[];
};

function csrf() {
  return (
    document.cookie
      .split(";")
      .map(x => x.trim())
      .find(x => x.startsWith("lms_csrf="))
      ?.split("=")[1] || ""
  );
}

type Draft = {
  title: string;
  chapter: string;
  description: string;
  embedUrl: string;
};

const blankDraft: Draft = {
  title: "",
  chapter: "",
  description: "",
  embedUrl: "",
};

export default function CourseManager({
  initial,
}: {
  initial: Course[];
}) {
  const [courses, setCourses] = useState(initial);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [download, setDownload] = useState(false);

  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [videoFiles, setVideoFiles] = useState<
    Record<string, File | undefined>
  >({});
  const [embedUrls, setEmbedUrls] = useState<Record<string, string>>({});
  const [attach, setAttach] = useState<
    Record<string, File | undefined>
  >({});
  const [busy, setBusy] = useState<string | null>(null);

  async function createCourse() {
    const r = await fetch("/api/courses", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": csrf(),
      },
      body: JSON.stringify({
        title,
        description: desc,
        courseDownloadAllowed: download,
      }),
    });

    const d = await r.json();

    if (r.ok) {
      setCourses([
        {
          ...d.course,
          lessons: [],
        },
        ...courses,
      ]);

      setTitle("");
      setDesc("");
    } else {
      alert(d.error || "Không thể tạo khóa học");
    }
  }

  async function addLesson(courseId: string) {
    const d = drafts[courseId] || blankDraft;

    if (!d.title.trim()) {
      return alert("Nhập tên bài học.");
    }

    setBusy(`lesson:${courseId}`);

    const videoUrl = d.embedUrl.trim() || null;

    const r = await fetch(`/api/lessons/${courseId}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": csrf(),
      },
      body: JSON.stringify({
        title: d.title,
        chapter: d.chapter || "Chương mới",
        description: d.description,
        videoType: "EMBED",
        videoUrl,
        videoDownloadAllowed: false,
      }),
    });

    const data = await r.json();

    if (r.ok) {
      setCourses(
        courses.map(c =>
          c.id === courseId
            ? {
                ...c,
                lessons: [...c.lessons, data.lesson],
              }
            : c
        )
      );

      setDrafts({
        ...drafts,
        [courseId]: blankDraft,
      });
    } else {
      alert(data.error || "Không thể tạo bài học");
    }

    setBusy(null);
  }

  async function uploadVideo(lessonId: string) {
    const file = videoFiles[lessonId];

    if (!file) {
      return alert("Chọn file video trước.");
    }

    if (!/^video\/(mp4|webm|ogg)$/.test(file.type)) {
      return alert("Chỉ hỗ trợ MP4, WebM hoặc OGG.");
    }

    setBusy(`video:${lessonId}`);

    try {
      /*
       * BƯỚC 1:
       * Xin Signed Upload URL từ server.
       */
      const prepare = await fetch("/api/storage/upload-url", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": csrf(),
        },
        body: JSON.stringify({
          kind: "video",
          filename: file.name,
          contentType: file.type,
        }),
      });

      const uploadInfo = await prepare.json();

      if (!prepare.ok) {
        alert(
          uploadInfo.error ||
            "Không thể chuẩn bị upload video."
        );
        return;
      }

      /*
       * BƯỚC 2:
       * Upload trực tiếp từ trình duyệt lên Supabase Storage.
       * Không đi qua Vercel.
       */
      const supabaseUrl =
        process.env.NEXT_PUBLIC_SUPABASE_URL;

      if (!supabaseUrl) {
        alert("Thiếu NEXT_PUBLIC_SUPABASE_URL.");
        return;
      }

      const upload = await fetch(
        `${supabaseUrl}/storage/v1/object/upload/sign/${uploadInfo.path}?token=${encodeURIComponent(
          uploadInfo.token
        )}`,
        {
          method: "PUT",
          headers: {
            "content-type":
              file.type || "application/octet-stream",
          },
          body: file,
        }
      );

      if (!upload.ok) {
        const errorText = await upload.text();

        console.error(
          "Supabase upload error:",
          errorText
        );

        alert(
          "Upload video lên Supabase thất bại."
        );

        return;
      }

      /*
       * BƯỚC 3:
       * Lưu đường dẫn video vào PostgreSQL.
       */
      const r = await fetch(
        `/api/lessons/${lessonId}`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            "x-csrf-token": csrf(),
          },
          body: JSON.stringify({
            videoType: "LOCAL",
            videoUrl: uploadInfo.storageKey,
          }),
        }
      );

      const data = await r.json();

      if (r.ok) {
        setCourses(
          courses.map(c => ({
            ...c,
            lessons: c.lessons.map(l =>
              l.id === lessonId
                ? {
                    ...l,
                    ...data.lesson,
                  }
                : l
            ),
          }))
        );

        setVideoFiles({
          ...videoFiles,
          [lessonId]: undefined,
        });
      } else {
        alert(
          data.error ||
            "Không thể gắn video."
        );
      }
    } catch (error) {
      console.error(error);
      alert("Upload video thất bại.");
    } finally {
      setBusy(null);
    }
  }

  async function saveEmbed(lessonId: string) {
    const url = (
      embedUrls[lessonId] ?? ""
    ).trim();

    if (!url) {
      return removeVideo(lessonId);
    }

    setBusy(`embed:${lessonId}`);

    const r = await fetch(
      `/api/lessons/${lessonId}`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": csrf(),
        },
        body: JSON.stringify({
          videoType: "EMBED",
          videoUrl: url,
        }),
      }
    );

    const data = await r.json();

    if (r.ok) {
      setCourses(
        courses.map(c => ({
          ...c,
          lessons: c.lessons.map(l =>
            l.id === lessonId
              ? {
                  ...l,
                  ...data.lesson,
                }
              : l
          ),
        }))
      );
    } else {
      alert(
        data.error ||
          "Không thể lưu link video."
      );
    }

    setBusy(null);
  }

  async function removeVideo(lessonId: string) {
    setBusy(`remove:${lessonId}`);

    const r = await fetch(
      `/api/lessons/${lessonId}`,
      {
        method: "DELETE",
        headers: {
          "x-csrf-token": csrf(),
        },
      }
    );

    const data = await r.json();

    if (r.ok) {
      setCourses(
        courses.map(c => ({
          ...c,
          lessons: c.lessons.map(l =>
            l.id === lessonId
              ? {
                  ...l,
                  ...data.lesson,
                }
              : l
          ),
        }))
      );
    } else {
      alert(
        data.error ||
          "Không thể gỡ video."
      );
    }

    setBusy(null);
  }

  async function toggleDownload(lesson: Lesson) {
    const r = await fetch(
      `/api/lessons/${lesson.id}`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": csrf(),
        },
        body: JSON.stringify({
          videoDownloadAllowed:
            !lesson.videoDownloadAllowed,
        }),
      }
    );

    const d = await r.json();

    if (r.ok) {
      setCourses(
        courses.map(c => ({
          ...c,
          lessons: c.lessons.map(l =>
            l.id === lesson.id
              ? {
                  ...l,
                  videoDownloadAllowed:
                    d.lesson.videoDownloadAllowed,
                }
              : l
          ),
        }))
      );
    } else {
      alert(
        d.error ||
          "Không thể đổi quyền tải video."
      );
    }
  }

  async function uploadAttachment(
    lessonId: string
  ) {
    const file = attach[lessonId];

    if (!file) {
      return alert("Chọn file tài liệu.");
    }

    setBusy(`attach:${lessonId}`);

    try {
      /*
       * BƯỚC 1:
       * Xin Signed Upload URL.
       */
      const prepare = await fetch(
        "/api/storage/upload-url",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-csrf-token": csrf(),
          },
          body: JSON.stringify({
            kind: "attachment",
            filename: file.name,
            contentType: file.type,
          }),
        }
      );

      const uploadInfo =
        await prepare.json();

      if (!prepare.ok) {
        alert(
          uploadInfo.error ||
            "Không thể chuẩn bị upload tài liệu."
        );

        return;
      }

      /*
       * BƯỚC 2:
       * Upload trực tiếp lên Supabase Storage.
       */
      const supabaseUrl =
        process.env.NEXT_PUBLIC_SUPABASE_URL;

      if (!supabaseUrl) {
        alert(
          "Thiếu NEXT_PUBLIC_SUPABASE_URL."
        );

        return;
      }

      const upload = await fetch(
        `${supabaseUrl}/storage/v1/object/upload/sign/${uploadInfo.path}?token=${encodeURIComponent(
          uploadInfo.token
        )}`,
        {
          method: "PUT",
          headers: {
            "content-type":
              file.type ||
              "application/octet-stream",
          },
          body: file,
        }
      );

      if (!upload.ok) {
        const errorText =
          await upload.text();

        console.error(
          "Supabase upload error:",
          errorText
        );

        alert(
          "Upload tài liệu lên Supabase thất bại."
        );

        return;
      }

      /*
       * BƯỚC 3:
       * Lưu thông tin tài liệu vào PostgreSQL.
       */
      const r = await fetch(
        `/api/attachments/${lessonId}`,
        {
          method: "POST",
          headers: {
            "content-type":
              "application/json",
            "x-csrf-token": csrf(),
          },
          body: JSON.stringify({
            storageKey:
              uploadInfo.storageKey,
            name: uploadInfo.name,
            mime: uploadInfo.mime,
            size: file.size,
          }),
        }
      );

      const d = await r.json();

      if (r.ok) {
        setCourses(
          courses.map(c => ({
            ...c,
            lessons: c.lessons.map(l =>
              l.id === lessonId
                ? {
                    ...l,
                    attachments: [
                      ...(l.attachments || []),
                      d.attachment,
                    ],
                  }
                : l
            ),
          }))
        );

        setAttach({
          ...attach,
          [lessonId]: undefined,
        });
      } else {
        alert(
          d.error ||
            "Không thể lưu tài liệu."
        );
      }
    } catch (error) {
      console.error(error);
      alert("Upload tài liệu thất bại.");
    } finally {
      setBusy(null);
    }
  }

  function draft(courseId: string) {
    return drafts[courseId] || blankDraft;
  }

  return (
    <div>
      <section className="card p-5">
        <h2 className="font-bold text-lg">
          Tạo khóa học
        </h2>

        <div className="grid md:grid-cols-2 gap-3 mt-4">
          <input
            className="input"
            placeholder="Tên khóa học / môn học"
            value={title}
            onChange={e =>
              setTitle(e.target.value)
            }
          />

          <label className="flex items-center gap-2 rounded-xl bg-slate-50 px-3">
            <input
              type="checkbox"
              checked={download}
              onChange={e =>
                setDownload(e.target.checked)
              }
            />

            Cho phép tải video toàn khóa học
          </label>
        </div>

        <textarea
          className="input mt-3 min-h-24"
          placeholder="Mô tả"
          value={desc}
          onChange={e =>
            setDesc(e.target.value)
          }
        />

        <button
          className="btn btn-primary mt-3"
          onClick={() =>
            void createCourse()
          }
        >
          Tạo khóa học
        </button>
      </section>

      <div className="space-y-4 mt-5">
        {courses.map(c => (
          <section
            key={c.id}
            className="card p-5"
          >
            <div className="flex justify-between gap-4">
              <div>
                <div className="font-bold text-lg">
                  {c.title}
                </div>

                <div className="text-sm text-slate-500 mt-1">
                  {c.description}
                </div>
              </div>

              <span className="pill pill-gray">
                {c.lessons.length} bài
              </span>
            </div>

            <div className="mt-5 space-y-4">
              {c.lessons.map(l => (
                <div
                  key={l.id}
                  className="rounded-2xl border border-slate-200 p-4"
                >
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-sm">
                        {l.title}
                      </div>

                      <div className="text-xs text-slate-400 mt-1">
                        {l.chapter} ·{" "}
                        {l.videoUrl
                          ? l.videoType ===
                            "EMBED"
                            ? "Video nhúng"
                            : "Video nội bộ"
                          : "Chưa có video"}
                      </div>
                    </div>

                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={
                          l.videoDownloadAllowed
                        }
                        onChange={() =>
                          void toggleDownload(l)
                        }
                        disabled={!l.videoUrl}
                      />

                      Cho phép tải video
                    </label>
                  </div>

                  <div className="mt-3 rounded-xl bg-slate-50 p-3 space-y-3">
                    {l.videoType ===
                      "EMBED" && (
                      <div className="flex flex-col sm:flex-row gap-2">
                        <div className="flex-1 relative">
                          <LinkIcon
                            className="absolute left-3 top-2.5 text-slate-400"
                            size={16}
                          />

                          <input
                            className="input pl-9"
                            placeholder="https://www.youtube.com/embed/... (để trống = không có video)"
                            value={
                              embedUrls[l.id] ??
                              l.videoUrl ??
                              ""
                            }
                            onChange={e =>
                              setEmbedUrls({
                                ...embedUrls,
                                [l.id]:
                                  e.target.value,
                              })
                            }
                          />
                        </div>

                        <button
                          className="btn btn-secondary flex items-center justify-center gap-2"
                          disabled={
                            busy ===
                            `embed:${l.id}`
                          }
                          onClick={() =>
                            void saveEmbed(l.id)
                          }
                        >
                          <Check size={16} />
                          Lưu link
                        </button>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <label className="btn btn-secondary cursor-pointer flex items-center justify-center gap-2">
                        <Upload size={16} />

                        {l.videoUrl
                          ? "Đổi video"
                          : "Tải video bài giảng"}

                        <input
                          type="file"
                          accept="video/mp4,video/webm,video/ogg"
                          className="hidden"
                          onChange={e =>
                            setVideoFiles({
                              ...videoFiles,
                              [l.id]:
                                e.target.files?.[0],
                            })
                          }
                        />
                      </label>

                      <span className="text-xs text-slate-500 truncate flex-1">
                        {videoFiles[l.id]?.name ||
                          (l.videoType ===
                            "LOCAL" &&
                          l.videoUrl
                            ? l.videoUrl
                            : "Chưa chọn file video")}
                      </span>

                      <button
                        className="btn btn-primary flex items-center justify-center gap-2"
                        disabled={
                          !videoFiles[l.id] ||
                          busy ===
                            `video:${l.id}`
                        }
                        onClick={() =>
                          void uploadVideo(
                            l.id
                          )
                        }
                      >
                        <Video size={16} />

                        {busy ===
                        `video:${l.id}`
                          ? "Đang tải…"
                          : "Upload & dùng video"}
                      </button>

                      <button
                        className="btn btn-danger flex items-center justify-center gap-2"
                        disabled={
                          !l.videoUrl ||
                          busy ===
                            `remove:${l.id}`
                        }
                        onClick={() =>
                          void removeVideo(
                            l.id
                          )
                        }
                      >
                        <Trash2 size={15} />
                        Gỡ video
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-3">
                    {(l.attachments || []).map(
                      a => (
                        <span
                          key={a.id}
                          className="pill pill-gray"
                        >
                          📎 {a.name}
                        </span>
                      )
                    )}

                    <label className="btn btn-secondary text-xs cursor-pointer">
                      + Tài liệu

                      <input
                        type="file"
                        className="hidden"
                        onChange={e =>
                          setAttach({
                            ...attach,
                            [l.id]:
                              e.target.files?.[0],
                          })
                        }
                      />
                    </label>

                    <button
                      className="btn btn-secondary text-xs"
                      disabled={
                        !attach[l.id] ||
                        busy ===
                          `attach:${l.id}`
                      }
                      onClick={() =>
                        void uploadAttachment(
                          l.id
                        )
                      }
                    >
                      {busy ===
                      `attach:${l.id}`
                        ? "Đang tải…"
                        : "Upload tài liệu"}
                    </button>
                  </div>
                </div>
              ))}

              {!c.lessons.length && (
                <div className="text-sm text-slate-400">
                  Chưa có bài học.
                </div>
              )}
            </div>

            <div className="mt-5 rounded-2xl border border-dashed border-slate-300 p-4">
              <div className="font-semibold text-sm mb-3">
                Thêm bài học — không tự gắn video
              </div>

              <div className="grid md:grid-cols-2 gap-2">
                <input
                  className="input"
                  placeholder="Tên bài học"
                  value={
                    draft(c.id).title
                  }
                  onChange={e =>
                    setDrafts({
                      ...drafts,
                      [c.id]: {
                        ...draft(c.id),
                        title: e.target.value,
                      },
                    })
                  }
                />

                <input
                  className="input"
                  placeholder="Tên chương"
                  value={
                    draft(c.id).chapter
                  }
                  onChange={e =>
                    setDrafts({
                      ...drafts,
                      [c.id]: {
                        ...draft(c.id),
                        chapter:
                          e.target.value,
                      },
                    })
                  }
                />
              </div>

              <textarea
                className="input mt-2 min-h-20"
                placeholder="Mô tả bài học"
                value={
                  draft(c.id).description
                }
                onChange={e =>
                  setDrafts({
                    ...drafts,
                    [c.id]: {
                      ...draft(c.id),
                      description:
                        e.target.value,
                    },
                  })
                }
              />

              <div className="mt-2 flex flex-col sm:flex-row gap-2">
                <input
                  className="input"
                  placeholder="Link video nhúng (có thể để trống)"
                  value={
                    draft(c.id).embedUrl
                  }
                  onChange={e =>
                    setDrafts({
                      ...drafts,
                      [c.id]: {
                        ...draft(c.id),
                        embedUrl:
                          e.target.value,
                      },
                    })
                  }
                />

                <button
                  className="btn btn-primary whitespace-nowrap"
                  disabled={
                    busy ===
                    `lesson:${c.id}`
                  }
                  onClick={() =>
                    void addLesson(c.id)
                  }
                >
                  Thêm bài
                </button>
              </div>

              <p className="text-xs text-slate-400 mt-2">
                Bạn có thể tạo bài không có video,
                sau đó upload video bài giảng hoặc
                thêm link YouTube/nhà cung cấp khác.
              </p>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}