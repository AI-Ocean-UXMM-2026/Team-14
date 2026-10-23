import {redirect} from 'next/navigation';
import {passwordLinkKeys,passwordLinkTarget} from '@/lib/supabase/password-links';
export default async function Home({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const params=await searchParams,query=new URLSearchParams();
  for(const key of [...passwordLinkKeys,'next']){const value=params[key];if(typeof value==='string')query.set(key,value);}
  if(['code','token_hash','error','error_code'].some(key=>query.has(key)))redirect(passwordLinkTarget(query));
  redirect('/login');
}
