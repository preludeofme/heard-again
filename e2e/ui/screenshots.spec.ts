import { test, expect } from '@playwright/test';
import fs from 'fs';

const routes = [
  '/',
  '/login',
  '/signup',
  '/forgot-password',
  '/pricing',
  '/privacy',
  '/dashboard',
  '/account',
  '/onboarding',
  '/family-tree',
  '/voice-lab',
  '/archive',
  '/chat',
  '/collections',
  '/contribute',
  '/documents',
  '/export',
  '/family-merge',
  '/favorites',
  '/import',
  '/self-hosting',
  '/setup-guide',
  '/subscription',
  '/timeline',
  '/tunnel-setup',
  '/search',
  '/profile',
  '/stories',
];

test.describe('Take screenshots of all pages', () => {
  test.beforeAll(async () => {
    if (!fs.existsSync('screenshots')) {
      fs.mkdirSync('screenshots');
    }
  });

  test('Screenshot each page', async ({ page }) => {
    // Increase timeout for the whole test since it visits many pages
    test.setTimeout(300000);

    // Login first
    console.log('Attempting to log in...');
    await page.goto('/login', { waitUntil: 'networkidle' });
    console.log(`Initial URL: ${page.url()}`);
    
    // Wait for the form to be visible
    console.log('Waiting for Sign In button...');
    try {
      await page.waitForSelector('button:has-text("Sign In")', { timeout: 10000 });
      console.log('Sign In button found.');

      const emailInput = page.getByLabel(/email address/i);
      const passwordInput = page.getByLabel(/password/i);
      
      console.log('Filling login form...');
      await emailInput.fill('demo@heardagain.com');
      await passwordInput.fill('demo123');
      await page.getByRole('button', { name: 'Sign In', exact: true }).click();

      console.log('Waiting for redirect...');
      await page.waitForTimeout(5000); // Give it some time to process
      console.log(`URL after login click: ${page.url()}`);
      
      try {
        await expect(page).toHaveURL(/\/profile|\/dashboard|\/familyspaces|\/archive/, { timeout: 20000 });
        console.log(`Successfully logged in. Current URL: ${page.url()}`);
      } catch (e) {
        console.error('Login redirect timed out or went to unexpected URL');
        console.log(`Current URL: ${page.url()}`);
        await page.screenshot({ path: `screenshots/debug_login_failed.png` });
      }
    } catch (e) {
      console.error('Sign In button not found within timeout');
      console.log(`Current URL: ${page.url()}`);
      await page.screenshot({ path: `screenshots/debug_no_form.png` });
    }

    await page.screenshot({ path: `screenshots/debug_post_login.png` });

    for (const route of routes) {
      console.log(`-------------------`);
      console.log(`Taking screenshot of ${route}`);
      try {
        await page.goto(route, { waitUntil: 'networkidle' });
        console.log(`URL after goto: ${page.url()}`);
        // Extra wait for animations or client-side rendering
        await page.waitForTimeout(2000);
        
        const fileName = route === '/' ? 'index' : route.replace(/^\/|\/$/g, '').replace(/\//g, '_');
        await page.screenshot({ path: `screenshots/${fileName}.png`, fullPage: true });
      } catch (error) {
        console.error(`Failed to take screenshot of ${route}:`, error);
      }
    }
  });
});
