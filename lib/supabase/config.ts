/** Public configuration only. Never return key contents in diagnostic messages. */
export function configurationError(url: string | undefined, key: string | undefined): string | undefined {
  if (!url?.trim() || !key?.trim())
    return 'School sign-in is not configured. Ask your administrator to check the Supabase URL and publishable key in Vercel, then redeploy.';
  try {
    const parsed = new URL(url);
    if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash || (parsed.pathname !== '/' && parsed.pathname !== '')) throw new Error();
  } catch {
    return 'The school Supabase URL is invalid. Ask your administrator to check the deployment settings.';
  }
  if (url !== url.trim() || key !== key.trim())
    return 'The school connection settings contain extra spaces. Ask your administrator to correct them and redeploy.';
}

export function publicConfigurationError() {
  return configurationError(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}
