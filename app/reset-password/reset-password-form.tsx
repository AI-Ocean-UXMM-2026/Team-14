'use client';
import Link from 'next/link';
import {useEffect,useRef,useState} from 'react';
import {createClient} from '@/lib/supabase/browser';
import {publicConfigurationError} from '@/lib/supabase/config';
import {passwordSessionKey} from '@/lib/supabase/password-links';
import ValidatedForm from '../components/validated-form';

export default function ResetPasswordForm({purpose='recovery'}:{purpose?:'recovery'|'invite'}) {
  const invitation=purpose==='invite';
  const started=useRef(false),generation=useRef(0),requestInFlight=useRef(false);
  const [phase,setPhase]=useState<'checking'|'ready'|'invalid'|'done'>('checking');
  const [showPassword,setShowPassword]=useState(false),[showConfirm,setShowConfirm]=useState(false);
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[password,setPassword]=useState(''),[confirm,setConfirm]=useState('');
  useEffect(()=>{
    const begin=()=>{
    if(started.current)return;started.current=true;
    const attempt=++generation.current;setPhase('checking');setError('');
    const url=new URL(window.location.href),fragment=new URLSearchParams(url.hash.slice(1));
    const access=fragment.get('access_token'),refresh=fragment.get('refresh_token'),type=fragment.get('type')??url.searchParams.get('type'),code=url.searchParams.get('code'),flowId=url.searchParams.get('sb_flow_id'),tokenHash=url.searchParams.get('token_hash');
    if(type==='invite'&&!invitation){window.location.replace('/set-password'+url.search+url.hash);return;}
    if(type==='recovery'&&invitation){window.location.replace('/reset-password'+url.search+url.hash);return;}
    // Remove URL credentials before verification and avoid a second one-time-token exchange on refresh.
    window.history.replaceState(null,'',url.pathname);
    void (async()=>{
      try {
        const configurationError=publicConfigurationError();
        if(configurationError){setError(configurationError);setPhase('invalid');return;}
        const client=createClient(),markerKey=passwordSessionKey(purpose,process.env.NEXT_PUBLIC_SUPABASE_URL!);
        const linkError=['error','error_code'].some(key=>fragment.has(key)||url.searchParams.has(key));
        const fresh=!!(access||refresh||code||tokenHash||linkError);
        if(fresh)try{sessionStorage.removeItem(markerKey);}catch{}
        if(linkError)throw new Error();
        let verifiedUser:{id:string}|null=null;
        if(type===purpose&&access&&refresh){
          const {data,error}=await client.auth.setSession({access_token:access,refresh_token:refresh});if(error)throw error;verifiedUser=data.user;
        }else if(tokenHash&&type===purpose){
          const {data,error}=await client.auth.verifyOtp({token_hash:tokenHash,type:purpose});if(error)throw error;verifiedUser=data.user;
        }else if(code){
          const {data,error}=await client.auth.exchangeCodeForSession(code,flowId?{flowId}:undefined);if(error)throw error;verifiedUser=data.user;
        }else if(!fresh){
          // This marker carries no tokens and grants no authority: revalidate the actual Auth user.
          let marker:{user?:string;expires?:number}|null=null;
          try{marker=JSON.parse(sessionStorage.getItem(markerKey)??'null');}catch{}
          if(!marker?.user||!marker.expires||marker.expires<=Date.now())throw new Error();
          const {data,error}=await client.auth.getUser();
          if(error||data.user?.id!==marker.user)throw new Error();verifiedUser=data.user;
        }
        if(!verifiedUser)throw new Error();
        if(fresh)try{sessionStorage.setItem(markerKey,JSON.stringify({user:verifiedUser.id,expires:Date.now()+15*60*1000}));}catch{}
        if(attempt===generation.current)setPhase('ready');
      }catch{if(attempt===generation.current)setPhase('invalid');}
    })();
    };
    const onHashChange=()=>{started.current=false;begin();};
    begin();window.addEventListener('hashchange',onHashChange);
    return ()=>window.removeEventListener('hashchange',onHashChange);
  },[purpose,invitation]);
  if(phase==='checking')return <p role="status">{invitation?'Checking your invitation…':'Checking your recovery link…'}</p>;
  if(phase==='invalid')return <><p role="alert">{error||(invitation?'This invitation is missing, expired or unavailable. Ask your school administrator to resend it.':'This recovery link is missing, expired or unavailable. Request a new link and open it in the same browser.')}</p>{!invitation&&<Link className="text-link" href="/forgot-password">Request a new recovery link</Link>}</>;
  if(phase==='done')return <><p role="status">{invitation?'Your password has been set. You can now sign in with your invited email and password.':'Your password has been updated. You can now sign in with your email and new password.'}</p>{error&&<p role="alert">{error}</p>}</>;
  return <ValidatedForm serverError={error} submitting={busy} validate={(data):Record<string,string>=>data.get('password')!==data.get('confirm')?{confirm:'Passwords must match.'}:{}} onSubmit={async event=>{
    event.preventDefault();if(requestInFlight.current)return;requestInFlight.current=true;setBusy(true);setError('');
    try{
      const client=createClient(),{error}=await client.auth.updateUser({password});
      if(error){setError(error.code==='weak_password'?'Choose a stronger password. Use at least 12 characters.':error.code==='same_password'?'Choose a password different from your current password.':invitation?'Unable to set your password. Try again or ask your administrator to resend the invitation.':'Unable to update your password. Try again or request a new recovery link.');return;}
      try{sessionStorage.removeItem(passwordSessionKey(purpose,process.env.NEXT_PUBLIC_SUPABASE_URL!));}catch{}
      // Password update has succeeded even if session revocation is temporarily unavailable.
      const {error:signOutError}=await client.auth.signOut().catch(()=>({error:true}));
      if(signOutError)setError('Your password was updated, but we could not sign out all sessions. Sign in again and contact your administrator to revoke other sessions.');
      setPassword('');setConfirm('');setPhase('done');
    }catch{setError('Unable to connect. Check your connection and try again.');}finally{requestInFlight.current=false;setBusy(false);}
  }}>
    <p className="signin-note">Choose a new password with at least 12 characters.</p>
    <label htmlFor="new-password">
      <span>New password</span>
      <div className="input-wrap">
        <input id="new-password" name="password" type={showPassword?'text':'password'} autoComplete="new-password" minLength={12} maxLength={1024} required value={password} onChange={e=>setPassword(e.target.value)}/>
        <button type="button" className="show" aria-label={showPassword?'Hide new password':'Show new password'} aria-controls="new-password" aria-pressed={showPassword} onClick={()=>setShowPassword(value=>!value)}>{showPassword?'Hide':'Show'}</button>
      </div>
    </label>
    <label htmlFor="confirm-password">
      <span>Confirm new password</span>
      <div className="input-wrap">
        <input id="confirm-password" name="confirm" type={showConfirm?'text':'password'} autoComplete="new-password" minLength={12} maxLength={1024} required value={confirm} onChange={e=>setConfirm(e.target.value)}/>
        <button type="button" className="show" aria-label={showConfirm?'Hide confirmed password':'Show confirmed password'} aria-controls="confirm-password" aria-pressed={showConfirm} onClick={()=>setShowConfirm(value=>!value)}>{showConfirm?'Hide':'Show'}</button>
      </div>
    </label>
    <button className="primary" type="submit" disabled={busy}>{busy?'Saving password…':invitation?'Set password':'Update password'}</button>
  </ValidatedForm>;
}
