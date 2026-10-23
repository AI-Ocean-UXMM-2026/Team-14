'use client';
import {useEffect} from 'react';
import {passwordLinkTarget} from '@/lib/supabase/password-links';
// Dashboard emails may use Site URL; keep Auth credentials out of the ordinary login flow.
export default function RecoveryRedirect(){
  useEffect(()=>{
    const url=new URL(window.location.href),fragment=new URLSearchParams(url.hash.slice(1));
    const type=fragment.get('type');
    if(type==='invite')url.searchParams.set('type','invite');
    if(type==='invite'||type==='recovery'||fragment.has('error_code')||['code','token_hash','error','error_code'].some(key=>url.searchParams.has(key)))
      window.location.replace(passwordLinkTarget(url.searchParams)+url.hash);
  },[]);
  return null;
}
