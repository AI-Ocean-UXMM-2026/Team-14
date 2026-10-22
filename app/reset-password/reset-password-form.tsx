'use client';
import Link from 'next/link';
import {useEffect,useRef,useState} from 'react';
import {createClient} from '@/lib/supabase/browser';
import {publicConfigurationError} from '@/lib/supabase/config';
import ValidatedForm from '../components/validated-form';

export default function ResetPasswordForm() {
  const started=useRef(false),generation=useRef(0),requestInFlight=useRef(false);
  const [phase,setPhase]=useState<'checking'|'ready'|'invalid'|'done'>('checking');
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[password,setPassword]=useState(''),[confirm,setConfirm]=useState('');
  useEffect(()=>{
    const begin=()=>{
    if(started.current)return;started.current=true;
    const attempt=++generation.current;setPhase('checking');setError('');
    const url=new URL(window.location.href),fragment=new URLSearchParams(url.hash.slice(1));
    const access=fragment.get('access_token'),refresh=fragment.get('refresh_token'),type=fragment.get('type'),code=url.searchParams.get('code'),flowId=url.searchParams.get('sb_flow_id');
    // Never leave credentials or recovery errors in browser history.
    window.history.replaceState(null,'',url.pathname);
    void (async()=>{
      try {
        const configurationError=publicConfigurationError();
        if(configurationError){setError(configurationError);setPhase('invalid');return;}
        const client=createClient();
        if(fragment.has('error')||url.searchParams.has('error'))throw new Error();
        if(type==='recovery'&&access&&refresh){
          const {error}=await client.auth.setSession({access_token:access,refresh_token:refresh});if(error)throw error;
        }else if(code){
          const {error}=await client.auth.exchangeCodeForSession(code,flowId?{flowId}:undefined);if(error)throw error;
        }else throw new Error();
        if(attempt===generation.current)setPhase('ready');
      }catch{if(attempt===generation.current)setPhase('invalid');}
    })();
    };
    const onHashChange=()=>{started.current=false;begin();};
    begin();window.addEventListener('hashchange',onHashChange);
    return ()=>window.removeEventListener('hashchange',onHashChange);
  },[]);
  if(phase==='checking')return <p role="status">Checking your recovery link…</p>;
  if(phase==='invalid')return <><p role="alert">{error||'This recovery link is missing, expired or unavailable. Request a new link and open it in the same browser.'}</p><Link className="text-link" href="/forgot-password">Request a new recovery link</Link></>;
  if(phase==='done')return <><p role="status">Your password has been updated. You can now sign in with your email and new password.</p>{error&&<p role="alert">{error}</p>}</>;
  return <ValidatedForm serverError={error} submitting={busy} validate={(data):Record<string,string>=>data.get('password')!==data.get('confirm')?{confirm:'Passwords must match.'}:{}} onSubmit={async event=>{
    event.preventDefault();if(requestInFlight.current)return;requestInFlight.current=true;setBusy(true);setError('');
    try{
      const client=createClient(),{error}=await client.auth.updateUser({password});
      if(error){setError(error.code==='weak_password'?'Choose a stronger password. Use at least 12 characters.':error.code==='same_password'?'Choose a password different from your current password.':'Unable to update your password. Try again or request a new recovery link.');return;}
      // Password update has succeeded even if session revocation is temporarily unavailable.
      const {error:signOutError}=await client.auth.signOut().catch(()=>({error:true}));
      if(signOutError)setError('Your password was updated, but we could not sign out all sessions. Sign in again and contact your administrator to revoke other sessions.');
      setPassword('');setConfirm('');setPhase('done');
    }catch{setError('Unable to connect. Check your connection and try again.');}finally{requestInFlight.current=false;setBusy(false);}
  }}>
    <p className="signin-note">Choose a new password with at least 12 characters.</p>
    <label htmlFor="new-password"><span>New password</span><input id="new-password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={1024} required value={password} onChange={e=>setPassword(e.target.value)}/></label>
    <label htmlFor="confirm-password"><span>Confirm new password</span><input id="confirm-password" name="confirm" type="password" autoComplete="new-password" minLength={12} maxLength={1024} required value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>
    <button className="primary" type="submit" disabled={busy}>{busy?'Updating password…':'Update password'}</button>
  </ValidatedForm>;
}
