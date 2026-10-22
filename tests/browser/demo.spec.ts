import { test, expect } from '@playwright/test';
import {loadEnvConfig} from '@next/env';
loadEnvConfig(process.cwd());
const configured=Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL&&process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
test('landing, demo search, eligibility and role isolation',async({page})=>{
 await page.goto('/');await page.getByRole('link',{name:'Explore the demo'}).click();
 await expect(page.getByRole('heading',{name:'A clearer view of your school.'})).toBeVisible();
 await expect(page.getByRole('cell',{name:'Pending correction',exact:true})).toBeVisible();
 await page.getByRole('textbox',{name:'Search teaching records'}).fill('U Min');
 await expect(page.locator('tbody tr')).toHaveCount(1);
 await page.getByRole('textbox',{name:'Search teaching records'}).fill('');
 await page.getByLabel('Demo perspective').selectOption('Teacher');
 await expect(page.locator('tbody tr')).toHaveCount(2);
 await expect(page.getByRole('cell',{name:'U Min Htet',exact:false})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Verify →'})).toHaveCount(0);
 await page.getByRole('button',{name:'Payroll',exact:true}).click();
 await expect(page.getByText('Approval and payment recording are not enabled in this demo.',{exact:false})).toBeVisible();
});
test('real workspace requires authentication',async({page})=>{
 await page.goto('/workspace');await expect(page).toHaveURL(/\/login$/);
 if(configured){await expect(page.getByLabel('Email address')).toBeVisible();await expect(page.getByLabel('Password',{exact:true})).toBeVisible();}
 else{await expect(page.getByText('School sign-in is not connected yet.',{exact:false})).toBeVisible();await expect(page.getByRole('button',{name:'Sign in'})).toHaveCount(0);}
});
test('mobile navigation and record filtering',async({page})=>{
 await page.setViewportSize({width:360,height:800});await page.goto('/demo');
 await page.getByRole('button',{name:'Teaching records'}).click();
 await page.getByRole('textbox',{name:'Search teaching records'}).fill('no matching record');
 await expect(page.getByText('No matching teaching records.')).toBeVisible();
 await expect(page.locator('body')).toHaveJSProperty('scrollWidth',360);
});

test('payroll and payment routes require real authentication',async({page})=>{await page.goto('/workspace/payroll');await expect(page).toHaveURL(/\/login$/);await expect(page.getByRole('heading',{name:'Payroll & payments',exact:true})).toHaveCount(0);});
