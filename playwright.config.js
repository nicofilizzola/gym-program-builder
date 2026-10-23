import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./e2e',workers:1,use:{baseURL:'http://127.0.0.1:3199',reducedMotion:'reduce'},webServer:{command:'node scripts/dev-server.js --test',url:'http://127.0.0.1:3199',reuseExistingServer:false},timeout:20000});
