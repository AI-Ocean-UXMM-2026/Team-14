import {test,expect} from '@playwright/test';

const user={id:'00000000-0000-4000-8000-000000000001',aud:'authenticated',role:'authenticated',email:'fictional@example.com',app_metadata:{provider:'email'},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};
function recoveryHash(){
 const encode=(v:object)=>Buffer.from(JSON.stringify(v)).toString('base64url');
 const token=[encode({alg:'HS256',typ:'JWT'}),encode({sub:user.id,exp:Math.floor(Date.now()/1000)+3600,iat:Math.floor(Date.now()/1000)}),'fictional-signature'].join('.');
 return '#type=recovery&access_token='+token+'&refresh_token=fictional-refresh';
}

test('forgot-password requests a recovery email with the hosted reset route',async({page})=>{
 let destination='',email='';
 await page.route('**/auth/v1/recover**',async route=>{const body=route.request().postDataJSON();email=body.email;destination=new URL(route.request().url()).searchParams.get('redirect_to')??'';await route.fulfill({status:200,json:{}});});
 await page.goto('/login');await page.getByRole('link',{name:'Forgot password?'}).click();await expect(page).toHaveURL(/\/forgot-password$/);
 await page.getByRole('textbox',{name:'Email address'}).fill('fictional@example.com');await page.getByRole('button',{name:'Send recovery link'}).click();
 await expect(page.getByRole('status')).toContainText('If an account exists');expect(email).toBe('fictional@example.com');expect(destination).toBe('http://127.0.0.1:3100/reset-password');
});

test('missing or rejected recovery links cannot update a password and are removed from the URL',async({page})=>{
 let writes=0;await page.route('**/auth/v1/user',async route=>{if(route.request().method()==='PUT')writes++;await route.fulfill({status:401,json:{message:'Invalid token'}});});
 await page.goto('/reset-password');await expect(page.getByRole('main').getByRole('alert')).toContainText('missing, expired or unavailable');await expect(page.getByRole('button',{name:'Update password'})).toHaveCount(0);
 await page.goto('/reset-password'+recoveryHash());await expect(page.getByRole('main').getByRole('alert')).toBeVisible();await expect(page).toHaveURL(/\/reset-password$/);expect(writes).toBe(0);
});

test('recovery validates matching passwords, updates the existing account and signs out',async({page})=>{
 let newPassword='',signedOut=false;
 await page.route('**/auth/v1/user',async route=>{if(route.request().method()==='PUT')newPassword=route.request().postDataJSON().password;await route.fulfill({status:200,json:user});});
 await page.route('**/auth/v1/logout**',async route=>{signedOut=true;await route.fulfill({status:204});});
 // Legacy root links must reach the reset form through the login redirect.
 await page.goto('/'+recoveryHash());await expect(page.getByRole('button',{name:'Update password'})).toBeVisible();await expect(page).toHaveURL(/\/reset-password$/);
 await page.getByLabel('New password',{exact:true}).fill('fictional-password-new');await page.getByLabel('Confirm new password',{exact:true}).fill('different-password');await page.getByRole('button',{name:'Update password'}).click();
 await expect(page.getByLabel('Confirm new password',{exact:true})).toHaveAccessibleDescription('Passwords must match.');expect(newPassword).toBe('');
 await page.getByLabel('Confirm new password',{exact:true}).fill('fictional-password-new');await page.getByRole('button',{name:'Update password'}).click();
 await expect(page.getByRole('status')).toContainText('Your password has been updated');expect(newPassword).toBe('fictional-password-new');expect(signedOut).toBe(true);
});

test('rejected password updates keep the recovery form available for retry',async({page})=>{
 await page.route('**/auth/v1/user',async route=>{await route.fulfill(route.request().method()==='PUT'?{status:422,json:{error_code:'weak_password',message:'Weak password'}}:{status:200,json:user});});
 await page.goto('/reset-password'+recoveryHash());await expect(page.getByLabel('New password',{exact:true})).toBeVisible();await page.getByLabel('New password',{exact:true}).fill('fictional-password-new');await page.getByLabel('Confirm new password',{exact:true}).fill('fictional-password-new');await page.getByRole('button',{name:'Update password'}).click();await expect(page.getByRole('main').getByRole('alert')).toContainText('Choose a stronger password');await expect(page.getByRole('button',{name:'Update password'})).toBeEnabled();
});


for(const entry of ['/reset-password','/','/login'])test('PKCE email recovery preserves codes at '+entry,async({page})=>{
 let verifier='',code='';
 await page.route('**/auth/v1/recover**',route=>route.fulfill({status:200,json:{}}));
 await page.route('**/auth/v1/token**',async route=>{const body=route.request().postDataJSON();verifier=body.code_verifier;code=body.auth_code;const params=new URLSearchParams(recoveryHash().slice(1));await route.fulfill({status:200,json:{access_token:params.get('access_token'),refresh_token:'fictional-refresh',token_type:'bearer',expires_in:3600,user}});});
 await page.goto('/forgot-password');await page.getByRole('textbox',{name:'Email address'}).fill('fictional@example.com');await page.getByRole('button',{name:'Send recovery link'}).click();await expect(page.getByRole('status')).toContainText('If an account exists');
 await page.goto(entry+'?code=fictional-code');await expect(page.getByRole('button',{name:'Update password'})).toBeVisible();await expect(page).toHaveURL(/\/reset-password$/);expect(code).toBe('fictional-code');expect(verifier.length).toBeGreaterThan(20);
});


test('recovery rate limits block repeat requests and allow a later retry',async({page})=>{
 await page.clock.install();let requests=0;
 await page.route('**/auth/v1/recover**',async route=>{requests++;await route.fulfill({status:429,json:{error_code:'over_email_send_rate_limit',message:'Rate limit'}});});
 await page.goto('/forgot-password');await page.getByRole('textbox',{name:'Email address'}).fill('fictional@example.com');await page.getByRole('button',{name:'Send recovery link'}).click();
 await expect(page.getByRole('main').getByRole('alert')).toContainText('project email limit may require a longer wait');await expect(page.getByRole('button',{name:/Try again in/})).toBeDisabled();expect(requests).toBe(1);
 await page.clock.runFor(61000);await expect(page.getByRole('button',{name:'Send recovery link'})).toBeEnabled();expect(requests).toBe(1);
});

test('recovery network failures preserve email and give a connection error',async({page})=>{
 await page.route('**/auth/v1/recover**',route=>route.abort());await page.goto('/forgot-password');await page.getByRole('textbox',{name:'Email address'}).fill('fictional@example.com');await page.getByRole('button',{name:'Send recovery link'}).click();
 await expect(page.getByRole('main').getByRole('alert')).toContainText('Unable to connect');await expect(page.getByRole('textbox',{name:'Email address'})).toHaveValue('fictional@example.com');
});

test('successful password update remains successful when global sign-out fails',async({page})=>{
 let updates=0;await page.route('**/auth/v1/user',async route=>{if(route.request().method()==='PUT')updates++;await route.fulfill({status:200,json:user});});
 await page.route('**/auth/v1/logout**',route=>route.fulfill({status:400,json:{message:'Sign-out unavailable'}}));
 await page.goto('/reset-password'+recoveryHash());await expect(page.getByLabel('New password',{exact:true})).toBeVisible();await page.getByLabel('New password',{exact:true}).fill('fictional-password-new');await page.getByLabel('Confirm new password',{exact:true}).fill('fictional-password-new');await page.getByRole('button',{name:'Update password'}).click();
 await expect(page.getByRole('status')).toContainText('Your password has been updated');await expect(page.getByRole('main').getByRole('alert')).toContainText('could not sign out all sessions');expect(updates).toBe(1);await expect(page.getByRole('button',{name:'Update password'})).toHaveCount(0);
});

test('rejected PKCE codes show a clean URL and request-new-link action',async({page})=>{
 await page.route('**/auth/v1/recover**',route=>route.fulfill({status:200,json:{}}));await page.route('**/auth/v1/token**',route=>route.fulfill({status:400,json:{error_code:'flow_state_expired',message:'Expired code'}}));
 await page.goto('/forgot-password');await page.getByRole('textbox',{name:'Email address'}).fill('fictional@example.com');await page.getByRole('button',{name:'Send recovery link'}).click();await expect(page.getByRole('status')).toContainText('If an account exists');await page.goto('/?code=expired-fictional-code');
 await expect(page.getByRole('main').getByRole('alert')).toContainText('expired');await expect(page).toHaveURL(/\/reset-password$/);await expect(page.getByRole('link',{name:'Request a new recovery link'})).toBeVisible();await expect(page.getByRole('button',{name:'Update password'})).toHaveCount(0);
});


test('new and confirmed passwords have independent accessible visibility controls',async({page})=>{
 let updates=0;await page.route('**/auth/v1/user',async route=>{if(route.request().method()==='PUT')updates++;await route.fulfill({status:200,json:user});});
 for(const width of [1440,360]){
  await page.setViewportSize({width,height:900});await page.goto('/reset-password'+recoveryHash());
  const password=page.getByLabel('New password',{exact:true}),confirm=page.getByLabel('Confirm new password',{exact:true});
  await expect(password).toBeVisible();await password.fill('fictional-password-new');await confirm.fill('fictional-confirmed-password');
  await page.getByRole('button',{name:'Show new password',exact:true}).click();await expect(password).toHaveAttribute('type','text');await expect(confirm).toHaveAttribute('type','password');await expect(page.getByRole('button',{name:'Hide new password',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'Show confirmed password',exact:true}).click();await expect(confirm).toHaveAttribute('type','text');
  await page.getByRole('button',{name:'Hide new password',exact:true}).click();await expect(password).toHaveAttribute('type','password');await expect(confirm).toHaveAttribute('type','text');
  await page.getByRole('button',{name:'Hide confirmed password',exact:true}).click();await expect(confirm).toHaveAttribute('type','password');await expect(password).toHaveValue('fictional-password-new');await expect(confirm).toHaveValue('fictional-confirmed-password');
  expect(updates).toBe(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 }
});

for(const entry of ['/','/login','/set-password','/reset-password'])test('invitation opens the set-password flow from '+entry,async({page})=>{
 let password='',signedOut=false;
 await page.route('**/auth/v1/user',async route=>{if(route.request().method()==='PUT'){const body=route.request().postDataJSON();password=body.password;for(const field of ['email','role','data','app_metadata','user_metadata'])expect(body).not.toHaveProperty(field);}await route.fulfill({status:200,json:user});});
 await page.route('**/auth/v1/logout**',async route=>{signedOut=true;await route.fulfill({status:204});});
 await page.goto(entry+recoveryHash().replace('type=recovery','type=invite'));
 await expect(page.getByRole('heading',{name:'Set your password',exact:true})).toBeVisible();await expect(page).toHaveURL(/\/set-password$/);
 await page.getByLabel('New password',{exact:true}).fill('fictional-invited-password');await page.getByLabel('Confirm new password',{exact:true}).fill('fictional-invited-password');await page.getByRole('button',{name:'Set password',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('Your password has been set');expect(password).toBe('fictional-invited-password');expect(signedOut).toBe(true);
});

test('expired invitations require an administrator to resend them',async({page})=>{
 await page.route('**/auth/v1/user',route=>route.fulfill({status:401,json:{message:'Expired token'}}));
 await page.goto('/set-password'+recoveryHash().replace('type=recovery','type=invite'));
 await expect(page.getByRole('main').getByRole('alert')).toContainText('Ask your school administrator to resend');await expect(page).toHaveURL(/\/set-password$/);await expect(page.getByRole('button',{name:'Set password',exact:true})).toHaveCount(0);await expect(page.getByRole('link',{name:'Request a new recovery link'})).toHaveCount(0);
});

test('unrecognized link types cannot open invitation password fields',async({page})=>{
 let requests=0;await page.route('**/auth/v1/user',async route=>{requests++;await route.fulfill({status:200,json:user});});
 await page.goto('/set-password'+recoveryHash().replace('type=recovery','type=signup'));
 await expect(page.getByRole('main').getByRole('alert')).toContainText('invitation is missing');await expect(page.getByLabel('New password',{exact:true})).toHaveCount(0);expect(requests).toBe(0);
});
