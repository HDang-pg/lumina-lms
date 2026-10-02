"use client";

import { useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Link as LinkIcon,
  Trash2,
  Upload,
  Video,
} from "lucide-react";

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

function csrf() {
  return (
    document.cookie
      .split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("lms_csrf="))
      ?.split("=")[1] || ""
  );
}

export default function CourseManager({
  initial,
}: {
  initial: Course[];
}) {
  const [courses, setCourses] = useState(initial);

  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [download, setDownload] = useState(false);

  const [drafts, setDrafts] =
    useState<Record<string, Draft>>({});
  const [videoFiles, setVideoFiles] =
    useState<Record<string, File | undefined>>({});
  const [embedUrls, setEmbedUrls] =
    useState<Record<string, string>>({});
  const [attach, setAttach] =
    useState<Record<string, File | undefined>>({});

  const [openCourses, setOpenCourses] =
    useState<Record<string, boolean>>({});
  const [openLessons, setOpenLessons] =
    useState<Record<string, boolean>>({});

  const [busy, setBusy] = useState<string | null>(null);

  function toggleCourse(courseId: string) {
    setOpenCourses((prev) => ({
      ...prev,
      [courseId]: !prev[courseId],
    }));
  }

  function toggleLesson(lessonId: string) {
    setOpenLessons((prev) => ({
      ...prev,
      [lessonId]: !prev[lessonId],
    }));
  }

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
      setCourses((prev) => [
        {
          ...d.course,
          lessons: [],
        },
        ...prev,
      ]);

      setTitle("");
      setDesc("");
      setDownload(false);
    } else {
      alert(d.error || "Không thể tạo khóa học.");
    }
  }

  async function deleteCourse(course: Course) {
    const ok = window.confirm(
      `Xóa khóa học "${course.title}"?\n\nTất cả bài học, video và tài liệu của khóa học sẽ bị xóa.`
    );

    if (!ok) return;

    setBusy(`delete-course:${course.id}`);

    try {
      const r = await fetch("/api/courses", {
        method: "DELETE",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": csrf(),
        },
        body: JSON.stringify({
          id: course.id,
        }),
      });

      const d = await r.json();

      if (!r.ok) {
        alert(d.error || "Không thể xóa khóa học.");
        return;
      }

      setCourses((prev) =>
        prev.filter((c) => c.id !== course.id)
      );
    } catch (error) {
      console.error(error);
      alert("Không thể xóa khóa học.");
    } finally {
      setBusy(null);
    }
  }

  async function addLesson(courseId: string) {
    const d = drafts[courseId] || blankDraft;

    if (!d.title.trim()) {
      return alert("Nhập tên bài học.");
    }

    setBusy(`lesson:${courseId}`);

    try {
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

      if (!r.ok) {
        alert(data.error || "Không thể tạo bài học.");
        return;
      }

      setCourses((prev) =>
        prev.map((c) =>
          c.id === courseId
            ? {
                ...c,
                lessons: [...c.lessons, data.lesson],
              }
            : c
        )
      );

      setDrafts((prev) => ({
        ...prev,
        [courseId]: blankDraft,
      }));
    } catch (error) {
      console.error(error);
      alert("Không thể tạo bài học.");
    } finally {
      setBusy(null);
    }
  }

  async function deleteLesson(lesson: Lesson) {
    const ok = window.confirm(
      `Xóa bài "${lesson.title}"?\n\nVideo, tài liệu và dữ liệu tiến độ của bài này sẽ bị xóa.`
    );

    if (!ok) return;

    setBusy(`delete-lesson:${lesson.id}`);

    try {
      const r = await fetch(`/api/lessons/${lesson.id}`, {
        method: "DELETE",
        headers: {
          "x-csrf-token": csrf(),
        },
      });

      const d = await r.json();

      if (!r.ok) {
        alert(d.error || "Không thể xóa bài học.");
        return;
      }

      setCourses((prev) =>
        prev.map((c) => ({
          ...c,
          lessons: c.lessons.filter(
            (l) => l.id !== lesson.id
          ),
        }))
      );

      setOpenLessons((prev) => ({
        ...prev,
        [lesson.id]: false,
      }));
    } catch (error) {
      console.error(error);
      alert("Không thể xóa bài học.");
    } finally {
      setBusy(null);
    }
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
      const prepare = await fetch(
        "/api/storage/upload-url",
        {
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
        }
      );

      const uploadInfo = await prepare.json();

      if (!prepare.ok) {
        alert(
          uploadInfo.error ||
            "Không thể chuẩn bị upload video."
        );
        return;
      }

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
        alert("Upload video lên Supabase thất bại.");
        return;
      }

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

      if (!r.ok) {
        alert(data.error || "Không thể gắn video.");
        return;
      }

      setCourses((prev) =>
        prev.map((c) => ({
          ...c,
          lessons: c.lessons.map((l) =>
            l.id === lessonId
              ? {
                  ...l,
                  ...data.lesson,
                }
              : l
          ),
        }))
      );

      setVideoFiles((prev) => ({
        ...prev,
        [lessonId]: undefined,
      }));
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

    try {
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

      if (!r.ok) {
        alert(
          data.error ||
            "Không thể lưu link video."
        );
        return;
      }

      setCourses((prev) =>
        prev.map((c) => ({
          ...c,
          lessons: c.lessons.map((l) =>
            l.id === lessonId
              ? {
                  ...l,
                  ...data.lesson,
                }
              : l
          ),
        }))
      );
    } catch (error) {
      console.error(error);
      alert("Không thể lưu link video.");
    } finally {
      setBusy(null);
    }
  }

  async function removeVideo(lessonId: string) {
    setBusy(`remove:${lessonId}`);

    try {
      // Gỡ video chỉ là PATCH videoUrl = null.
      // Không dùng DELETE vì DELETE lesson là xóa cả bài.
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
            videoUrl: null,
            videoDownloadAllowed: false,
          }),
        }
      );

      const data = await r.json();

      if (!r.ok) {
        alert(
          data.error ||
            "Không thể gỡ video."
        );
        return;
      }

      setCourses((prev) =>
        prev.map((c) => ({
          ...c,
          lessons: c.lessons.map((l) =>
            l.id === lessonId
              ? {
                  ...l,
                  ...data.lesson,
                }
              : l
          ),
        }))
      );

      setEmbedUrls((prev) => ({
        ...prev,
        [lessonId]: "",
      }));
    } catch (error) {
      console.error(error);
      alert("Không thể gỡ video.");
    } finally {
      setBusy(null);
    }
  }

  async function toggleDownload(lesson: Lesson) {
    try {
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

      if (!r.ok) {
        alert(
          d.error ||
            "Không thể đổi quyền tải video."
        );
        return;
      }

      setCourses((prev) =>
        prev.map((c) => ({
          ...c,
          lessons: c.lessons.map((l) =>
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
    } catch (error) {
      console.error(error);
      alert("Không thể đổi quyền tải video.");
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

      const uploadInfo = await prepare.json();

      if (!prepare.ok) {
        alert(
          uploadInfo.error ||
            "Không thể chuẩn bị upload tài liệu."
        );
        return;
      }

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
          "Upload tài liệu lên Supabase thất bại."
        );
        return;
      }

      const r = await fetch(
        `/api/attachments/${lessonId}`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-csrf-token": csrf(),
          },
          body: JSON.stringify({
            storageKey: uploadInfo.storageKey,
            name: uploadInfo.name,
            mime: uploadInfo.mime,
            size: file.size,
          }),
        }
      );

      const d = await r.json();

      if (!r.ok) {
        alert(
          d.error ||
            "Không thể lưu tài liệu."
        );
        return;
      }

      setCourses((prev) =>
        prev.map((c) => ({
          ...c,
          lessons: c.lessons.map((l) =>
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

      setAttach((prev) => ({
        ...prev,
        [lessonId]: undefined,
      }));
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
            onChange={(e) =>
              setTitle(e.target.value)
            }
          />

          <label className="flex items-center gap-2 rounded-xl bg-slate-50 px-3">
            <input
              type="checkbox"
              checked={download}
              onChange={(e) =>
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
          onChange={(e) =>
            setDesc(e.target.value)
          }
        />

        <button
          className="btn btn-primary mt-3"
          onClick={() => void createCourse()}
        >
          Tạo khóa học
        </button>
      </section>

      <div className="space-y-4 mt-5">
        {courses.map((c) => {
          const courseOpen = !!openCourses[c.id];

          return (
            <section
              key={c.id}
              className="card overflow-hidden"
            >
              {/* COURSE HEADER */}
              <div className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <button
                    type="button"
                    className="flex items-center gap-3 text-left min-w-0 flex-1"
                    onClick={() =>
                      toggleCourse(c.id)
                    }
                  >
                    <span className="shrink-0 rounded-xl bg-slate-100 p-2">
                      {courseOpen ? (
                        <ChevronDown size={20} />
                      ) : (
                        <ChevronRight size={20} />
                      )}
                    </span>

                    <span className="min-w-0">
                      <span className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-lg">
                          📚 {c.title}
                        </span>

                        <span className="pill pill-gray">
                          {c.lessons.length} bài
                        </span>
                      </span>

                      <span className="block text-sm text-slate-500 mt-1">
                        {c.description}
                      </span>
                    </span>
                  </button>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() =>
                        toggleCourse(c.id)
                      }
                    >
                      {courseOpen ? "Đóng" : "Mở"}
                    </button>

                    <button
                      type="button"
                      className="btn btn-danger flex items-center gap-2"
                      disabled={
                        busy ===
                        `delete-course:${c.id}`
                      }
                      onClick={() =>
                        void deleteCourse(c)
                      }
                    >
                      <Trash2 size={15} />
                      Xóa khóa học
                    </button>
                  </div>
                </div>
              </div>

              {/* COURSE CONTENT */}
              {courseOpen && (
                <div className="border-t border-slate-200 bg-slate-50/50 p-5">
                  <div className="space-y-3">
                    {c.lessons.map((l, index) => {
                      const lessonOpen =
                        !!openLessons[l.id];

                      return (
                        <div
                          key={l.id}
                          className="rounded-2xl border border-slate-200 bg-white overflow-hidden"
                        >
                          {/* LESSON HEADER */}
                          <button
                            type="button"
                            className="w-full text-left p-4"
                            onClick={() =>
                              toggleLesson(l.id)
                            }
                          >
                            <div className="flex items-center gap-3">
                              <span className="shrink-0 rounded-lg bg-slate-100 p-2">
                                {lessonOpen ? (
                                  <ChevronDown size={17} />
                                ) : (
                                  <ChevronRight size={17} />
                                )}
                              </span>

                              <span className="min-w-0 flex-1">
                                <span className="flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold">
                                    Bài {index + 1}:{" "}
                                    {l.title}
                                  </span>

                                  <span className="pill pill-gray">
                                    {l.chapter}
                                  </span>
                                </span>

                                <span className="block text-xs text-slate-400 mt-1">
                                  {l.videoUrl
                                    ? l.videoType ===
                                      "EMBED"
                                      ? "Video nhúng"
                                      : "Video nội bộ"
                                    : "Chưa có video"}
                                </span>
                              </span>

                              <span className="text-sm text-slate-500 shrink-0">
                                {lessonOpen
                                  ? "Đóng"
                                  : "Mở"}
                              </span>
                            </div>
                          </button>

                          {/* LESSON CONTENT */}
                          {lessonOpen && (
                            <div className="border-t border-slate-200 p-4 space-y-4">
                              {/* VIDEO */}
                              <div className="rounded-2xl border border-slate-200 p-4">
                                <div className="font-semibold flex items-center gap-2">
                                  <Video size={17} />
                                  Video
                                </div>

                                <div className="mt-3 space-y-3">
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
                                          placeholder="Link video nhúng"
                                          value={
                                            embedUrls[
                                              l.id
                                            ] ??
                                            l.videoUrl ??
                                            ""
                                          }
                                          onChange={(e) =>
                                            setEmbedUrls(
                                              (prev) => ({
                                                ...prev,
                                                [l.id]:
                                                  e.target
                                                    .value,
                                              })
                                            )
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
                                          void saveEmbed(
                                            l.id
                                          )
                                        }
                                      >
                                        <Check size={16} />
                                        Lưu link
                                      </button>
                                    </div>
                                  )}

                                  <div className="flex flex-col lg:flex-row gap-2">
                                    <label className="btn btn-secondary cursor-pointer flex items-center justify-center gap-2">
                                      <Upload size={16} />

                                      {l.videoUrl
                                        ? "Đổi video"
                                        : "Upload video"}

                                      <input
                                        type="file"
                                        accept="video/mp4,video/webm,video/ogg"
                                        className="hidden"
                                        onChange={(e) =>
                                          setVideoFiles(
                                            (prev) => ({
                                              ...prev,
                                              [l.id]:
                                                e.target
                                                  .files?.[0],
                                            })
                                          )
                                        }
                                      />
                                    </label>

                                    <span className="text-xs text-slate-500 truncate flex-1 self-center">
                                      {videoFiles[l.id]
                                        ?.name ||
                                        (l.videoType ===
                                          "LOCAL" &&
                                        l.videoUrl
                                          ? l.videoUrl
                                          : "Chưa chọn file")}
                                    </span>

                                    <button
                                      className="btn btn-primary flex items-center justify-center gap-2"
                                      disabled={
                                        !videoFiles[
                                          l.id
                                        ] ||
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
                                        ? "Đang upload..."
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

                                  <label className="flex items-center gap-2 text-sm">
                                    <input
                                      type="checkbox"
                                      checked={
                                        l.videoDownloadAllowed
                                      }
                                      disabled={
                                        !l.videoUrl
                                      }
                                      onChange={() =>
                                        void toggleDownload(
                                          l
                                        )
                                      }
                                    />
                                    Cho phép tải video
                                  </label>
                                </div>
                              </div>

                              {/* ATTACHMENTS */}
                              <div className="rounded-2xl border border-slate-200 p-4">
                                <div className="font-semibold">
                                  📎 Tài liệu
                                </div>

                                <div className="flex flex-wrap gap-2 mt-3">
                                  {(l.attachments || []).map(
                                    (a) => (
                                      <span
                                        key={a.id}
                                        className="pill pill-gray"
                                      >
                                        📎 {a.name}
                                      </span>
                                    )
                                  )}
                                </div>

                                <div className="flex flex-col sm:flex-row gap-2 mt-3">
                                  <label className="btn btn-secondary text-xs cursor-pointer">
                                    Chọn tài liệu
                                    <input
                                      type="file"
                                      className="hidden"
                                      onChange={(e) =>
                                        setAttach(
                                          (prev) => ({
                                            ...prev,
                                            [l.id]:
                                              e.target
                                                .files?.[0],
                                          })
                                        )
                                      }
                                    />
                                  </label>

                                  <span className="text-xs text-slate-500 self-center truncate flex-1">
                                    {attach[l.id]
                                      ?.name ||
                                      "Chưa chọn file"}
                                  </span>

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
                                      ? "Đang upload..."
                                      : "Upload tài liệu"}
                                  </button>
                                </div>
                              </div>

                              {/* DELETE LESSON */}
                              <div className="flex justify-end pt-1">
                                <button
                                  type="button"
                                  className="btn btn-danger flex items-center gap-2"
                                  disabled={
                                    busy ===
                                    `delete-lesson:${l.id}`
                                  }
                                  onClick={() =>
                                    void deleteLesson(l)
                                  }
                                >
                                  <Trash2 size={15} />
                                  {busy ===
                                  `delete-lesson:${l.id}`
                                    ? "Đang xóa..."
                                    : "Xóa bài"}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {!c.lessons.length && (
                      <div className="rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-400 bg-white">
                        Chưa có bài học.
                      </div>
                    )}
                  </div>

                  {/* ADD LESSON */}
                  <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white p-4">
                    <div className="font-semibold text-sm mb-3">
                      Thêm bài học
                    </div>

                    <div className="grid md:grid-cols-2 gap-2">
                      <input
                        className="input"
                        placeholder="Tên bài học"
                        value={draft(c.id).title}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [c.id]: {
                              ...draft(c.id),
                              title: e.target.value,
                            },
                          }))
                        }
                      />

                      <input
                        className="input"
                        placeholder="Tên chương"
                        value={draft(c.id).chapter}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [c.id]: {
                              ...draft(c.id),
                              chapter:
                                e.target.value,
                            },
                          }))
                        }
                      />
                    </div>

                    <textarea
                      className="input mt-2 min-h-20"
                      placeholder="Mô tả bài học"
                      value={
                        draft(c.id).description
                      }
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [c.id]: {
                            ...draft(c.id),
                            description:
                              e.target.value,
                          },
                        }))
                      }
                    />

                    <div className="mt-2 flex flex-col sm:flex-row gap-2">
                      <input
                        className="input"
                        placeholder="Link video nhúng (có thể để trống)"
                        value={
                          draft(c.id).embedUrl
                        }
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [c.id]: {
                              ...draft(c.id),
                              embedUrl:
                                e.target.value,
                            },
                          }))
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
                      Tạo bài trước, sau đó upload video
                      hoặc thêm link video.
                    </p>
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
