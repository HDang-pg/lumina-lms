"use client";
import { useState } from "react";
function csrf(){return document.cookie.split(";").map(x=>x.trim()).find(x=>x.startsWith("lms_csrf="))?.split("=")[1]||""}
export default function MarkComplete({lessonId,initial}:{lessonId:string;initial:boolean}){const[done,setDone]=useState(initial);const[b,setB]=useState(false);async function go(){setB(true);const r=await fetch('/api/progress',{method:'POST',headers:{'content-type':'application/json','x-csrf-token':csrf()},body:JSON.stringify({lessonId,watchedSec:900,duration:900})});if(r.ok)setDone(true);setB(false)}return <button disabled={done||b} className={`btn ${done?'btn-success':'btn-secondary'}`} onClick={go}>{done?'✓ Đã hoàn thành':b?'Đang lưu…':'Đánh dấu đã học'}</button>}
