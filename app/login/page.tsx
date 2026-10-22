import Link from 'next/link';
import { login } from './actions';
import { isConfigured } from '@/lib/supabase/server';
export const dynamic='force-dynamic';
export default async function Login({searchParams}:{searchParams:Promise<{status?:string}>}){
 const configured=isConfigured();const {status}=await searchParams;
 return <main className="login-card"><Link className="brand" href="/">S↗ SayaSync</Link><h1 style={{marginTop:35}}>Welcome back.</h1><p className="muted">Your school’s teacher management workspace. Access is by invitation from your school administrator.</p>{!configured?<div className="demo-banner">School sign-in is not connected yet. Configure a development Supabase project to enable authentication.</div>:<form action={login}><label htmlFor="email">Email address</label><input id="email" name="email" type="email" autoComplete="username" maxLength={254} required/><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="current-password" maxLength={1024} required/><button className="button" type="submit">Sign in →</button></form>}{status&&<p role="alert">{status==='access-denied'?'An active school membership is required. Contact your administrator.':'Unable to sign in. Check your details or contact your administrator.'}</p>}<p className="muted" style={{marginTop:25}}>Need an invitation or help accessing your account? Contact your school administrator. SayaSync does not offer public registration.</p><Link className="secondary" href="/demo">Explore with fictional data →</Link></main>
}
