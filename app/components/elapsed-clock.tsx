'use client';
import {useEffect,useState} from 'react';
export default function ElapsedClock({start}:{start?:string}){
 const [now,setNow]=useState<number|null>(null);useEffect(()=>{setNow(Date.now());const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
 const seconds=now&&start?Math.max(0,Math.floor((now-Date.parse(start))/1000)):0;
 const value=now?start?[Math.floor(seconds/3600),Math.floor(seconds/60)%60,seconds%60].map(n=>String(n).padStart(2,'0')).join(':'):new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Yangon',hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(now):'--:--:--';
 return <div className="live-clock" role="timer" aria-live="off" aria-label={start?'Elapsed teaching time':'Current time'}>{value}</div>;
}
