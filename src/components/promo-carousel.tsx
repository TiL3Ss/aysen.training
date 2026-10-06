"use client";
import Link from "next/link";
import { useEffect,useState } from "react";
import { ChevronLeft,ChevronRight } from "lucide-react";
type Banner={id:string;title:string;message:string;linkText:string;linkUrl:string;backgroundColor:string;textColor:string;fontSize:number;bold:boolean;italic:boolean};
export function PromoCarousel({banners,fallback}:{banners:Banner[];fallback:string}){
 const [index,setIndex]=useState(0); useEffect(()=>{if(banners.length<2)return;const timer=window.setInterval(()=>setIndex(i=>(i+1)%banners.length),6000);return()=>window.clearInterval(timer)},[banners.length]);
 if(!banners.length)return <div className="topline">{fallback}</div>;
 const b=banners[index%banners.length];return <div className="promo-carousel" style={{backgroundColor:b.backgroundColor,color:b.textColor,fontSize:`${b.fontSize}px`,fontWeight:b.bold?700:400,fontStyle:b.italic?"italic":"normal"}} aria-live="polite"><button aria-label="Banner anterior" disabled={banners.length<2} onClick={()=>setIndex(i=>(i-1+banners.length)%banners.length)}><ChevronLeft size={17}/></button><div className="promo-carousel-copy promo-slide" key={b.id}><span className="promo-carousel-title">{b.title}</span><span>{b.message}</span>{b.linkText&&<Link href={b.linkUrl}>{b.linkText}</Link>}</div><span className="promo-carousel-dots">{banners.map((x,i)=><button key={x.id} aria-label={`Ver banner ${i+1}`} aria-current={index===i} onClick={()=>setIndex(i)}/>)}</span><button aria-label="Siguiente banner" disabled={banners.length<2} onClick={()=>setIndex(i=>(i+1)%banners.length)}><ChevronRight size={17}/></button></div>
}
