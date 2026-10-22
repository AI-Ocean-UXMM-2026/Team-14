'use client';
import {useState} from 'react';
import {createClient} from '@/lib/supabase/browser';
import ValidatedForm from '../components/validated-form';

export default function ForgotPasswordForm(){
  const [email,setEmail]=useState(''),[busy,setBusy]=useState(false),[sent,setSent]=useState(false),[error,setError]=useState('');
  if(sent)return <p role="status">If an account exists for this email, a recovery link will be sent. Check your inbox and spam folder, then open the link in this browser.</p>;
  return <ValidatedForm serverError={error} submitting={busy} onSubmit={async event=>{
    event.preventDefault();if(busy)return;setBusy(true);setError('');
    try{
      const {error}=await createClient().auth.resetPasswordForEmail(email.trim(),{redirectTo:window.location.origin+'/reset-password'});
      if(error){setError(error.status===429?'Please wait before requesting another recovery link.':'Unable to send a recovery email. Try again or contact your administrator.');return;}
      setSent(true);
    }catch{setError('School account access is unavailable. Try again or contact your administrator.');}finally{setBusy(false);}
  }}>
    <p className="signin-note">Enter your school account email to request a password reset.</p>
    <label htmlFor="recovery-email"><span>Email address</span><input id="recovery-email" name="email" type="email" autoComplete="email" maxLength={254} placeholder="you@example.com" required value={email} onChange={e=>setEmail(e.target.value)}/></label>
    <button className="primary" type="submit" disabled={busy}>{busy?'Sending…':'Send recovery link'}</button>
  </ValidatedForm>;
}
