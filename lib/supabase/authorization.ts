import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from './server';
export async function requireMembership() {
  const client=await createClient();
  const {data:{user},error}=await client.auth.getUser();
  if(error||!user) redirect('/login');
  const {data:membership,error:membershipError}=await client.from('memberships').select('id,school_id,role').eq('user_id',user.id).eq('active',true).maybeSingle();
  if(membershipError||!membership) redirect('/login?status=access-denied');
  return {client,user,membership};
}
