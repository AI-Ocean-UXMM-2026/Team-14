import {createServerClient} from '@supabase/ssr';
import {NextResponse,type NextRequest} from 'next/server';
import {publicConfigurationError} from './lib/supabase/config';

// Persist refreshed cookies before Server Components read the authenticated user.
// Authorization still uses getUser + active school membership in the data layer.
export async function proxy(request:NextRequest){
  let response=NextResponse.next({request});
  if(!publicConfigurationError()){
    const client=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{
      cookies:{getAll:()=>request.cookies.getAll(),setAll(values){
        values.forEach(({name,value})=>request.cookies.set(name,value));
        response=NextResponse.next({request});
        values.forEach(({name,value,options})=>response.cookies.set(name,value,options));
      }}
    });
    try{await client.auth.getUser();}catch{/* The protected route still checks identity; outages do not grant access. */}
  }
  response.headers.set('Cache-Control','private, no-store');
  return response;
}
export const config={matcher:['/workspace/:path*']};
