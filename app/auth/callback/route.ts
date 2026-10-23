import {NextResponse} from 'next/server';
import {createClient,isConfigured} from '@/lib/supabase/server';
import {passwordLinkTarget} from '@/lib/supabase/password-links';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'};
// Keep redirects on the browser's origin even behind a proxy with an internal request host.
const redirect=(location:string)=>new NextResponse(null,{status:303,headers:{...headers,Location:location}});

export async function GET(request:Request){
  const url=new URL(request.url),params=url.searchParams,type=params.get('type');
  // Password callbacks must reach the password form before their one-time code is consumed.
  // Explicit next=/workspace retains support for ordinary email/OAuth sign-in callbacks.
  if(params.get('next')==='/workspace'&&!params.has('token_hash')&&type!=='recovery'&&type!=='invite'){
    const code=params.get('code');
    if(code&&isConfigured())try{
      const client=await createClient();
      const {error}=await client.auth.exchangeCodeForSession(code);
      if(!error)return redirect('/workspace');
    }catch{/* Return a safe sign-in error; never log the code. */}
    return redirect('/login?status=failed');
  }
  return redirect(passwordLinkTarget(params));
}
