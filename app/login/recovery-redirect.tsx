'use client';
import {useEffect} from 'react';
// Dashboard emails may use Site URL; support both PKCE and implicit callbacks.
export default function RecoveryRedirect(){
  useEffect(()=>{
    const url=new URL(window.location.href),fragment=new URLSearchParams(url.hash.slice(1));
    const query=new URLSearchParams();
    for(const key of ['code','sb_flow_id','error','error_code']){const value=url.searchParams.get(key);if(value)query.set(key,value);}
    if(query.has('code')||query.has('error')||query.has('error_code')||fragment.get('type')==='recovery'||fragment.has('error_code'))
      window.location.replace('/reset-password'+(query.size?'?'+query:'')+url.hash);
  },[]);
  return null;
}
