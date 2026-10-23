export type PasswordPurpose = 'recovery' | 'invite';
export const passwordLinkKeys = ['code','sb_flow_id','token_hash','type','error','error_code'] as const;

/** Only fixed local destinations are accepted; never forward a caller's external next URL. */
export function passwordLinkTarget(params:URLSearchParams){
  const invite=params.get('type')==='invite'||params.get('next')==='/set-password';
  const query=new URLSearchParams();
  for(const key of passwordLinkKeys){const value=params.get(key);if(value)query.set(key,value);}
  return (invite?'/set-password':'/reset-password')+(query.size?'?'+query:'');
}

export function passwordSessionKey(purpose:PasswordPurpose,projectUrl:string){
  return 'sayasync-password-flow:'+new URL(projectUrl).host+':'+purpose;
}
