import {redirect} from 'next/navigation';
export default async function Home({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const params=await searchParams;
  // Supabase can fall back to Site URL; preserve recovery codes at the root.
  const recovery=new URLSearchParams();
  for(const key of ['code','sb_flow_id','error','error_code']) {
    const value=params[key];if(typeof value==='string')recovery.set(key,value);
  }
  if(recovery.has('code')||recovery.has('error')||recovery.has('error_code'))redirect('/reset-password?'+recovery);
  redirect('/login');
}
