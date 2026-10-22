'use client';
import {useEffect} from 'react';
// Dashboard-issued recovery emails can still use the project's root Site URL.
export default function RecoveryRedirect(){
  useEffect(()=>{
    const fragment=new URLSearchParams(window.location.hash.slice(1));
    if(fragment.get('type')==='recovery'||fragment.has('error_code'))window.location.replace('/reset-password'+window.location.hash);
  },[]);
  return null;
}
