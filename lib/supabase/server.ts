import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { publicConfigurationError } from './config';
export function isConfigured() { return !publicConfigurationError(); }
export async function createClient() {
  if (!isConfigured()) throw new Error('Supabase development project is not configured');
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: { getAll: () => store.getAll(), setAll: values => {
      try { values.forEach(({name,value,options}) => store.set(name,value,options)); }
      catch { /* Server Components cannot write cookies. Actions and callback can. */ }
    }}
  });
}
