import {test,expect} from '@playwright/test';
const harness='http://127.0.0.1:4175/';
test('mobile drawer traps focus, makes background inert and restores focus on Escape',async({page})=>{
 await page.setViewportSize({width:360,height:800});await page.goto('/demo');await expect(page.locator('#sidebar')).toHaveJSProperty('inert',true);const toggle=page.getByRole('button',{name:'Toggle navigation'});await toggle.click();await expect(page.getByRole('dialog',{name:'Navigation'})).toBeVisible();await expect(page.locator('.main-shell')).toHaveJSProperty('inert',true);await expect(page.locator('.sidebar-close')).toBeFocused();await page.locator('#sidebar .brand').focus();await page.keyboard.press('Shift+Tab');await expect(page.locator('.reset-link')).toBeFocused();await page.keyboard.press('Tab');await expect(page.locator('#sidebar .brand')).toBeFocused();await page.keyboard.press('Escape');await expect(toggle).toBeFocused();await expect(page.locator('.main-shell')).toHaveJSProperty('inert',false);await expect(page.locator('#sidebar')).toHaveJSProperty('inert',true);await page.setViewportSize({width:1440,height:1000});await expect(page.locator('#sidebar')).toHaveJSProperty('inert',false);
});
test('login validates fields inline and focuses the first invalid field',async({page})=>{
 await page.goto('/login');const email=page.getByRole('textbox',{name:'Email address'});await expect(email).toBeVisible();await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(email).toBeFocused();await expect(email).toHaveAttribute('aria-invalid','true');await expect(email).toHaveAccessibleDescription('This field is required.');await email.fill('invalid-email');await page.getByLabel('Password',{exact:true}).fill('fictional-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(email).toHaveAccessibleDescription('Enter a valid email address.');await expect(page.getByLabel('Password',{exact:true})).toHaveValue('fictional-password');
});
test('correction detects invalid end times inline before calling the action',async({page})=>{
 await page.goto(harness+'?screen=records&role=teacher&view=sessions');await page.getByRole('button',{name:'Details',exact:true}).first().click();await page.getByRole('button',{name:'Request correction',exact:true}).click();await page.getByLabel('Correct start date',{exact:true}).fill('2026-10-14');await page.getByLabel('Correct start time',{exact:true}).fill('09:00');await page.getByLabel('Correct end date',{exact:true}).fill('2026-10-14');await page.getByLabel('Correct end time',{exact:true}).fill('08:00');await page.getByLabel('Reason (required)',{exact:true}).fill('Fictional correction');await page.getByRole('button',{name:'Submit request',exact:true}).click();await expect(page.getByLabel('Correct end time',{exact:true})).toBeFocused();await expect(page.getByRole('heading',{name:'Request a time correction',exact:true})).toBeInViewport();await expect(page.getByLabel('Correct end time',{exact:true})).toHaveAttribute('aria-invalid','true');await expect(page.getByRole('alert')).not.toContainText('This record changed');await page.getByLabel('Correct end time',{exact:true}).fill('10:00');await expect(page.getByLabel('Correct end time',{exact:true})).not.toHaveAttribute('aria-invalid','true');await page.getByRole('button',{name:'Submit request',exact:true}).click();await expect(page.getByRole('alert')).toContainText('This record changed');await expect(page.getByRole('alert')).toBeFocused();
});
test('payroll date shortcuts change only inputs until calculation',async({page})=>{
 await page.goto(harness+'?screen=finance');await page.getByRole('button',{name:'This week',exact:true}).click();await expect(page.getByLabel('Period start',{exact:true})).toHaveValue('2026-10-19');await expect(page.getByLabel('Period end',{exact:true})).toHaveValue('2026-10-25');await expect(page.locator('.payroll-totals')).toContainText('147,000');await expect(page.getByText('Calculate a draft to update the preview for these dates.')).toBeVisible();await page.getByRole('button',{name:'Last week',exact:true}).click();await expect(page.getByLabel('Period start',{exact:true})).toHaveValue('2026-10-12');await expect(page.getByRole('button',{name:'Last week',exact:true})).toHaveAttribute('aria-pressed','true');
});
test('record references stay in Details instead of crowding the main table',async({page})=>{
 await page.goto(harness+'?screen=records&view=sessions');await expect(page.locator('tbody')).not.toContainText('00000003-000');await expect(page.locator('tbody')).toContainText('C101');await page.getByRole('button',{name:'Details',exact:true}).first().click();await page.getByText('Record reference',{exact:true}).click();await expect(page.getByRole('dialog').locator('code')).toHaveText(/[0-9a-f]{8}-/);
});
test('successful review produces a specific dismissible confirmation',async({page})=>{
 await page.goto(harness+'?screen=records&view=sessions&action_result=success');await page.getByRole('button',{name:'Verify record',exact:true}).first().click();await page.getByRole('button',{name:'Save verification',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByRole('status')).toContainText('Class record verified');await page.getByRole('button',{name:'Dismiss confirmation'}).click();await expect(page.getByRole('status')).toHaveCount(0);
});
test('Teacher active class status appears beside its assigned class',async({page})=>{
 await page.clock.install({time:new Date('2026-10-22T03:30:00Z')});await page.goto('/demo?role=teacher');await page.getByRole('button',{name:'Check in to Mathematics',exact:true}).click();await expect(page.locator('.class-option').filter({hasText:'Mathematics'})).toContainText('In progress');await page.getByRole('button',{name:'All my records',exact:true}).click();await expect(page.getByRole('heading',{name:'My class records',exact:true})).toBeVisible();
});

test('prototype login layout and password toggle remain available on desktop and mobile',async({page})=>{
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:900});await page.goto('/login');
  await expect(page.getByRole('img',{name:'Saya-Sync',exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Sign in',exact:true})).toBeVisible();
  await expect(page.getByText('Demo accounts',{exact:true})).toBeVisible();
  await expect(page.getByRole('link',{name:'Admin',exact:true})).toHaveAttribute('href','/demo?role=admin');
  await expect(page.getByRole('link',{name:'Teacher',exact:true})).toHaveAttribute('href','/demo?role=teacher');
  const password=page.getByLabel('Password',{exact:true});await password.fill('fictional-password');
  await expect(password).toHaveAttribute('type','password');const inputBox=await password.boundingBox(),toggleBox=await page.getByRole('button',{name:'Show password'}).boundingBox();expect(inputBox).not.toBeNull();expect(toggleBox).not.toBeNull();expect(Math.abs((inputBox!.y+inputBox!.height/2)-(toggleBox!.y+toggleBox!.height/2))).toBeLessThanOrEqual(2);await page.getByRole('button',{name:'Show password'}).click();
  await expect(password).toHaveAttribute('type','text');await page.getByRole('button',{name:'Hide password'}).click();
  await expect(password).toHaveAttribute('type','password');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 }
});
