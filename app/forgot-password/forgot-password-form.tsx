'use client';
import {useEffect,useRef,useState} from 'react';
import {publicConfigurationError} from '@/lib/supabase/config';
import {createClient} from '@/lib/supabase/browser';
import ValidatedForm from '../components/validated-form';

export default function ForgotPasswordForm(){
  const requestInFlight=useRef(false);
  const [cooldown,setCooldown]=useState(0),[retryAt,setRetryAt]=useState(0);
  useEffect(()=>{
    if(!retryAt)return;
    const timer=window.setInterval(()=>{
      const remaining=Math.max(0,Math.ceil((retryAt-Date.now())/1000));
      setCooldown(remaining);if(!remaining)window.clearInterval(timer);
    },250);
    return ()=>window.clearInterval(timer);
  },[retryAt]);
  const [email,setEmail]=useState(''),[busy,setBusy]=useState(false),[sent,setSent]=useState(false),[error,setError]=useState('');
  if(sent)return <p role="status">If an account exists for this email, a recovery link will be sent. Check your inbox and spam folder, then open the link in this browser.</p>;
  return <ValidatedForm serverError={error} submitting={busy} onSubmit={async event=>{
    event.preventDefault();if(requestInFlight.current||cooldown)return;
    const configurationError=publicConfigurationError();if(configurationError){setError(configurationError);return;}
    requestInFlight.current=true;setBusy(true);setError('');
    try{
      const {error}=await createClient().auth.resetPasswordForEmail(email.trim(),{redirectTo:window.location.origin+'/reset-password'});
      if(error){
        if(error.status===429){setCooldown(60);setRetryAt(Date.now()+60000);setError('Too many recovery requests. Wait at least 60 seconds before retrying. Your project email limit may require a longer wait.');}
        else setError(!error.status||error.status>=500?'Unable to connect to school accounts. Check your connection and try again shortly.':'Unable to send a recovery email. Try again or contact your administrator.');return;}
      setSent(true);
    }catch{setError('Unable to connect to school accounts. Check your connection and try again shortly.');}finally{requestInFlight.current=false;setBusy(false);}
  }}>
    <p className="signin-note">Enter your school account email to request a password reset.</p>
    <label htmlFor="recovery-email"><span>Email address</span><input id="recovery-email" name="email" type="email" autoComplete="email" maxLength={254} placeholder="you@example.com" required value={email} onChange={e=>setEmail(e.target.value)}/></label>
    <button className="primary" type="submit" disabled={busy||cooldown>0}>{busy?'Sending…':cooldown>0?`Try again in ${cooldown}s`:'Send recovery link'}</button>
  </ValidatedForm>;
}
