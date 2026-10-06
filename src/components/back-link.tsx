"use client";
import { useRouter } from "next/navigation";
export function BackLink({fallback="/"}:{fallback?:string}){const router=useRouter();return <button type="button" className="back-link" onClick={()=>{if(window.history.length>1)router.back();else router.push(fallback)}}>← Volver</button>}
