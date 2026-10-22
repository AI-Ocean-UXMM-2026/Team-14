import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'./tests/browser', use:{baseURL:'http://127.0.0.1:3000',headless:true,launchOptions:{executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium'}},webServer:{command:'npm run dev',url:'http://127.0.0.1:3000',reuseExistingServer:true},reporter:'list'});
