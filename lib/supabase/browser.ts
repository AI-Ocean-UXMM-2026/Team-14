import { createBrowserClient } from '@supabase/ssr';
import { publicConfigurationError } from './config';

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const error = publicConfigurationError();
  if (error) throw new Error(error);
  // Recovery tokens are consumed explicitly and removed from the address bar.
  return createBrowserClient(url!, key!, { auth: { detectSessionInUrl: false } });
}
