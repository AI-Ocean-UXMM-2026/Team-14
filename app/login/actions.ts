'use server';
import { redirect } from 'next/navigation';
import { createClient, isConfigured } from '@/lib/supabase/server';
export async function login(form:FormData) {
  if(!isConfigured()) redirect('/login?status=not-configured');
  const email=String(form.get('email')??'').trim(); const password=String(form.get('password')??'');
  if(!email||email.length>254||!password||password.length>1024) redirect('/login?status=failed');
  const client=await createClient();
  const {error}=await client.auth.signInWithPassword({email,password});
  if(error) redirect('/login?status=failed');
  // Workspace resolves active membership independently; form inputs never select role.
  redirect('/workspace');
}
export async function logout(){const client=await createClient();await client.auth.signOut();redirect('/login');}
