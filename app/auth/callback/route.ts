import { NextResponse } from 'next/server';
import { createClient, isConfigured } from '@/lib/supabase/server';
export async function GET(request:Request){
 const url=new URL(request.url); const code=url.searchParams.get('code');
 if(code&&isConfigured()){
  const client=await createClient(); const {error}=await client.auth.exchangeCodeForSession(code);
  if(!error) return NextResponse.redirect(new URL('/workspace',url.origin),{headers:{'Cache-Control':'no-store'}});
 }
 return NextResponse.redirect(new URL('/login?status=failed',url.origin),{headers:{'Cache-Control':'no-store'}});
}
