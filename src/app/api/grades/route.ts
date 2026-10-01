import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/auth";
import { assertCsrf } from "@/lib/csrf";
import { z } from "zod";
const schema=z.object({answerId:z.string(),pointsEarned:z.number().min(0).max(100),feedback:z.string().max(3000).default("")});
export async function PATCH(req:Request){
  const s=await readSession(); if(!s||s.role!=="TEACHER")return NextResponse.json({error:"Unauthorized"},{status:401});
  try{await assertCsrf(req)}catch{return NextResponse.json({error:"CSRF"},{status:403})}
  const b=schema.parse(await req.json());
  const a=await prisma.answer.findUnique({where:{id:b.answerId},include:{question:true,attempt:{include:{exam:true}}}});
  if(!a||a.attempt.exam.teacherId!==s.id)return NextResponse.json({error:"Forbidden"},{status:403});
  if(b.pointsEarned>a.question.points)return NextResponse.json({error:"Điểm vượt quá điểm tối đa của câu."},{status:400});
  await prisma.answer.update({where:{id:a.id},data:{pointsEarned:b.pointsEarned,feedback:b.feedback,graded:true}});
  const answers=await prisma.answer.findMany({where:{attemptId:a.attemptId}}); const questions=await prisma.question.findMany({where:{id:{in:answers.map(x=>x.questionId)}}});
  const total=questions.reduce((x,q)=>x+q.points,0)||1; const earned=answers.reduce((x,y)=>x+y.pointsEarned,0); const score=Math.round((earned/total)*100)/10;
  await prisma.attempt.update({where:{id:a.attemptId},data:{score}}); return NextResponse.json({ok:true,score});
}
