'use client';
import {useState} from 'react';
import {useFormStatus} from 'react-dom';
import {login} from './actions';
function Submit(){const {pending}=useFormStatus();return <button className="primary" disabled={pending}>{pending?'Signing in…':'Sign in'} <span aria-hidden="true">→</span></button>}
export default function LoginForm(){const [show,setShow]=useState(false);return <form id="login-form" action={login}><label htmlFor="email"><span>Email address</span><input id="email" name="email" type="email" autoComplete="username" placeholder="you@example.com" maxLength={254} required/></label><label htmlFor="password"><span>Password</span><div className="input-wrap"><input id="password" name="password" type={show?'text':'password'} autoComplete="current-password" placeholder="Enter your password" maxLength={1024} required/><button type="button" className="show" aria-label={show?'Hide password':'Show password'} aria-pressed={show} onClick={()=>setShow(!show)}>{show?'Hide':'Show'}</button></div></label><Submit/></form>}
