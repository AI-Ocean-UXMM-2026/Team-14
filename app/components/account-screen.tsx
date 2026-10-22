import Link from 'next/link';
import type {ReactNode} from 'react';

export default function AccountScreen({title,children}:{title:string;children:ReactNode}) {
  return <div className="login-page"><a className="skip-link" href="#account-form">Skip to form</a><div className="layout">
    <aside className="story" aria-label="Saya-Sync"><Link className="brand" href="/login" aria-label="Saya-Sync home"><img className="primary-logo" src="/prototype/saya-sync.svg" alt="Saya-Sync"/></Link><h2 className="story-heading"><span lang="en">Teaching records.<br/>Clearer decisions.</span><span className="myanmar-heading" lang="my">သင်ကြားမှုမှတ်တမ်းမှ<br/>ရှင်းလင်းသော ဆုံးဖြတ်ချက်များဆီသို့</span></h2></aside>
    <main className="signin"><div className="form-wrap" id="account-form" tabIndex={-1}><h1>{title}</h1>{children}<p className="signin-note"><Link className="text-link" href="/login">Back to sign in</Link></p></div></main>
  </div></div>;
}
