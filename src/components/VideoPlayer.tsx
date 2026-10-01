"use client";

import { useEffect, useRef } from "react";

export function VideoPlayer({ lessonId, url, type, downloadAllowed, onProgress }: { lessonId: string; url?: string | null; type: "LOCAL" | "EMBED"; downloadAllowed: boolean; onProgress?: (seconds: number, duration: number) => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v || !onProgress) return;
    const fn = () => onProgress(Math.floor(v.currentTime), Math.floor(v.duration || 0));
    v.addEventListener("timeupdate", fn);
    return () => v.removeEventListener("timeupdate", fn);
  }, [onProgress]);

  if (type === "EMBED" && url) return <div className="aspect-video rounded-2xl overflow-hidden bg-slate-900"><iframe className="w-full h-full" src={url} title="Lesson video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /></div>;
  if (type === "LOCAL" && url) return <div className="aspect-video rounded-2xl overflow-hidden bg-slate-900"><video ref={ref} className="w-full h-full" controls controlsList={downloadAllowed ? undefined : "nodownload"} src={`/api/videos/${lessonId}`} /></div>;
  return <div className="aspect-video rounded-2xl overflow-hidden bg-slate-50 border border-dashed border-slate-300 flex items-center justify-center px-6 text-center"><div><div className="font-semibold text-slate-600">Chưa có video bài giảng</div><div className="text-sm text-slate-400 mt-1">Giáo viên chưa gắn video cho bài học này.</div></div></div>;
}
