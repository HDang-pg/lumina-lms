import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/guards";
import { Role } from "@prisma/client";
import { VideoPlayer } from "@/components/VideoPlayer";
import { ProgressBar } from "@/components/ProgressBar";
import MarkComplete from "@/components/MarkComplete";
import DiscussionBox from "@/components/DiscussionBox";
export default async function CoursePage({params}:{params:Promise<{id:string}>}){
  const s=await requireRole(Role.STUDENT); const {id}=await params;
  const enrollment=await prisma.enrollment.findUnique({
    where:{studentId_courseId:{studentId:s.id,courseId:id}},
    include:{course:{include:{lessons:{include:{attachments:true,progress:{where:{studentId:s.id}}},orderBy:{sortOrder:"asc"}}}}}
  });
  if(!enrollment)notFound(); const c=enrollment.course;
  return <div className="container-page fade-in">
    <div className="mb-6"><Link href="/dashboard/courses" className="text-sm text-[#4f7cac]">← Khóa học</Link><h1 className="text-3xl font-bold mt-2">{c.title}</h1><p className="text-slate-500 mt-2 max-w-3xl">{c.description}</p><div className="mt-4 max-w-xl"><div className="flex justify-between text-sm mb-2"><span>Tiến độ</span><b>{enrollment.progressPct}%</b></div><ProgressBar value={enrollment.progressPct}/></div></div>
    <div className="space-y-6">{c.lessons.map((l,i)=>{const p=l.progress[0];return <section key={l.id} className="card p-5">
      <div className="flex items-start justify-between gap-4 mb-4"><div><span className="pill pill-gray">{l.chapter}</span><h2 className="text-xl font-bold mt-2">{i+1}. {l.title}</h2><p className="text-sm text-slate-500 mt-1">{l.description}</p></div><span className={`pill ${p?.completed?"pill-green":"pill-blue"}`}>{p?.completed?"Đã hoàn thành":"Đang học"}</span></div>
      <VideoPlayer lessonId={l.id} url={l.videoUrl} type={l.videoType} downloadAllowed={l.videoDownloadAllowed || c.courseDownloadAllowed}/>
      <div className="flex flex-wrap gap-2 mt-4"><MarkComplete lessonId={l.id} initial={!!p?.completed}/>{l.attachments.map(a=><a key={a.id} href={`/api/download/${a.id}`} className="btn btn-secondary text-sm">📎 {a.name}</a>)}{!l.attachments.length&&<span className="text-sm text-slate-400">Chưa có tài liệu đính kèm.</span>}</div>
      <Discussion lessonId={l.id}/>
    </section>})}</div>
  </div>
}
async function Discussion({lessonId}:{lessonId:string}){const posts=await prisma.discussionPost.findMany({where:{lessonId},include:{author:{select:{name:true,role:true}}},orderBy:{createdAt:"asc"},take:20});return <div className="mt-5 border-t border-slate-100 pt-5"><h3 className="font-semibold">Hỏi đáp</h3>{posts.length?<div className="space-y-3 mt-3">{posts.map(p=><div key={p.id} className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-slate-400">{p.author.name} · {p.author.role==="TEACHER"?"Giáo viên":"Học sinh"}</div><div className="text-sm mt-1">{p.content}</div></div>)}</div>:<div className="text-sm text-slate-400 mt-3">Chưa có câu hỏi. Khu vực này dành cho trao đổi trực tiếp dưới bài học.</div>}<DiscussionBox lessonId={lessonId}/></div>}
