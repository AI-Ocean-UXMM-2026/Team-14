import {test,expect} from '@playwright/test';
test('prototype navigation, search and Teacher perspective',async({page})=>{
 await page.goto('/');await expect(page).toHaveURL(/\/login$/);await page.getByRole('link',{name:'Admin',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Academy overview'})).toBeVisible();
 await page.getByRole('button',{name:'Class records',exact:true}).click();
 await page.getByRole('searchbox',{name:'Search records'}).fill('Ko Min Thu');await expect(page.locator('tbody tr')).toHaveCount(3);
 await page.getByLabel('Demo perspective').selectOption('teacher');await page.getByRole('button',{name:'My class records',exact:true}).click();
 await expect(page.locator('tbody tr')).toHaveCount(3);await expect(page.getByRole('cell',{name:'Ko Min Thu',exact:false})).toHaveCount(0);await expect(page.getByRole('button',{name:'Verify record',exact:true})).toHaveCount(0);
});
test('correction separates dates and times and confirms unsaved changes',async({page})=>{
 await page.goto('/demo?role=teacher');await page.getByRole('button',{name:'My class records',exact:true}).click();await page.getByRole('button',{name:'Details',exact:true}).first().click();await page.getByRole('button',{name:'Request correction',exact:true}).click();
 for(const label of ['Correct start date','Correct start time','Correct end date','Correct end time'])await expect(page.getByLabel(label,{exact:true})).toBeVisible();
 await page.getByLabel('Reason / Admin comment').fill('A correction explanation');await page.keyboard.press('Escape');await expect(page.getByText('Discard unsaved changes?')).toBeVisible();await page.getByRole('button',{name:'Keep editing'}).click();await expect(page.getByLabel('Reason / Admin comment')).toHaveValue('A correction explanation');await page.keyboard.press('Escape');await page.getByRole('button',{name:'Discard changes'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('mobile navigation and table stay within viewport',async({page})=>{
 await page.setViewportSize({width:360,height:800});await page.goto('/demo');await page.getByRole('button',{name:'Toggle navigation'}).click();await page.getByRole('button',{name:'Class records',exact:true}).click();await page.getByRole('searchbox',{name:'Search records'}).fill('no matching record');await expect(page.getByRole('heading',{name:'No matching class records'})).toBeVisible();await expect(page.locator('body')).toHaveJSProperty('scrollWidth',360);
});
test('real workspace and payroll require authentication',async({page})=>{
 for(const path of ['/workspace','/workspace/payroll','/workspace/manage']){await page.goto(path);await expect(page).toHaveURL(/\/login$/);await expect(page.getByRole('heading',{name:'Sign in',exact:true})).toBeVisible();}
});
test('prototype verification, payroll approval, payment and browser persistence',async({page})=>{
 await page.goto('/demo');await page.getByRole('button',{name:'Class records',exact:true}).click();
 for(const id of ['S0001','S0002']){const row=page.locator('tbody tr').filter({hasText:id});await row.getByRole('button',{name:'Verify record',exact:true}).click();await page.getByRole('button',{name:'Save verification',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);}
 await page.getByRole('button',{name:'Payroll',exact:true}).click();await page.getByRole('button',{name:'Calculate draft'}).click();await expect(page.locator('.payroll-totals')).toContainText('147,000');await page.getByRole('button',{name:'Approve payroll',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Approve payroll',exact:true}).click();await page.getByRole('button',{name:'Record payments',exact:true}).click();await page.getByRole('button',{name:'Record payment',exact:true}).first().click();await page.getByLabel('Reference or cash receipt note').fill('Fictional receipt');await page.getByRole('dialog').getByRole('button',{name:'Record payment',exact:true}).click();await expect(page.getByRole('button',{name:'Reverse',exact:true})).toHaveCount(1);
 await page.reload();await expect(page.getByRole('button',{name:'Reverse',exact:true})).toHaveCount(1);await page.getByLabel('Demo perspective').selectOption('teacher');await page.getByRole('button',{name:'My payments',exact:true}).click();await expect(page.locator('tbody tr')).toHaveCount(1);await expect(page.getByRole('button',{name:'Record payment',exact:true})).toHaveCount(0);
});
test('Teacher check-in uses a green elapsed timer and prevents a second active class',async({page})=>{
 await page.clock.install({time:new Date('2026-10-22T03:30:00Z')});await page.goto('/demo?role=teacher');await page.getByRole('button',{name:'Check in to Mathematics',exact:true}).click();await expect(page.locator('.clock-card.is-running')).toBeVisible();await expect(page.getByRole('timer',{name:'Elapsed teaching time'})).toHaveText('00:00:00');await page.clock.fastForward(65000);await expect(page.getByRole('timer',{name:'Elapsed teaching time'})).toHaveText('00:01:05');await expect(page.getByRole('button',{name:'Check in to English',exact:true})).toBeDisabled();await page.getByRole('button',{name:'Check out',exact:true}).click();await expect(page.getByRole('timer',{name:'Elapsed teaching time'})).toHaveCount(0);
});
