import { chromium, Browser, Page } from 'playwright';
import { performance } from 'perf_hooks';
import * as fs from 'fs';

// Setup file logging
const LOG_FILE = 'stress-test.log';
const originalLog = console.log;
const originalError = console.error;

function writeLog(type: string, args: any[]) {
  const msg = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
  const logLine = `[${new Date().toISOString()}] [${type}] ${msg}\n`;
  fs.appendFileSync(LOG_FILE, logLine);
}

console.log = (...args) => {
  writeLog('INFO', args);
  originalLog(...args);
};

console.error = (...args) => {
  writeLog('ERROR', args);
  originalError(...args);
};


// Configuration
const BASE_URL = process.env.BASE_URL || 'https://heardagain.com';
const PASSWORD = 'testpassword123';

const TEST_RUN_ID = Date.now();
const TEST_ACCOUNTS = [
  `stress1_${TEST_RUN_ID}@email.com`,
  `stress2_${TEST_RUN_ID}@email.com`,
  `stress3_${TEST_RUN_ID}@email.com`,
  `stress4_${TEST_RUN_ID}@email.com`,
  `stress5_${TEST_RUN_ID}@email.com`
];

async function signupAndOnboard(page: Page, email: string, sessionId: number) {
  console.log(`[Session ${sessionId}] [${email}] Starting signup...`);
  await page.goto(`${BASE_URL}/signup`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Fill signup form
  await page.getByLabel(/email|email address/i).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Confirm Password', { exact: true }).fill(PASSWORD);
  await page.getByLabel(/first name|first/i).fill(`TestUser${sessionId}`);
  await page.getByLabel(/last name|last/i).fill('StressTest');
  
  await page.getByRole('button', { name: 'Create Account', exact: true }).click();
  
  try {
    await page.waitForURL(/\/onboarding/, { timeout: 15000 });
    console.log(`[Session ${sessionId}] [${email}] Signup successful, completing onboarding...`);
    
    // Onboarding Step 1: Family Name
    await page.getByLabel(/Family Name/i).fill(`Family Test ${sessionId}`);
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.waitForTimeout(1000);

    // Onboarding Step 2: First Name
    await page.getByLabel(/First Name/i).fill(`TestUser${sessionId}`);
    await page.getByRole('button', { name: 'Get Started' }).click();
    
    await page.waitForURL(/\/family-tree/, { timeout: 15000 });
    console.log(`[Session ${sessionId}] [${email}] Onboarding complete.`);
    await page.waitForLoadState('networkidle');
  } catch (err) {
    const hasError = await page.getByText(/error|failed|already exists/i).first().isVisible().catch(() => false);
    if (hasError) {
      console.log(`[Session ${sessionId}] [${email}] Account already exists or error. Attempting login instead...`);
      await login(page, email, sessionId);
    } else if (page.url().includes('/login') || page.url().includes('/dashboard') || page.url().includes('/family-tree')) {
       console.log(`[Session ${sessionId}] [${email}] Redirected elsewhere, proceeding...`);
    } else {
      throw new Error(`Signup/Onboarding failed: ${err}`);
    }
  }
}

async function login(page: Page, email: string, sessionId: number) {
  console.log(`[Session ${sessionId}] [${email}] Logging in...`);
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const emailField = page.getByLabel(/email/i);
  const passwordField = page.getByLabel('Password', { exact: true });
  const signInButton = page.getByRole('button', { name: 'Sign In', exact: true });

  await emailField.fill(email);
  await passwordField.fill(PASSWORD);
  await signInButton.click();

  await page.waitForURL(/\/legacy|\/dashboard|\/profile|\/family-tree/, { timeout: 30000 });
  console.log(`[Session ${sessionId}] [${email}] Login successful.`);
}

async function createStoryAndGenerateAudio(page: Page, email: string, sessionId: number) {
  await page.waitForLoadState('networkidle');
  console.log(`[Session ${sessionId}] [${email}] Fetching subject ID and setting up MFA...`);
  
  const speakeasy = require('speakeasy');
  const jsQR = require('jsqr');
  const { createCanvas, loadImage } = require('canvas');
  
  // Step 1: Initialize MFA setup if necessary
  const mfaSetupScript = `
    (async () => {
      const getCsrfToken = async () => {
        try {
          const res = await fetch('/api/csrf-token');
          const data = await res.json();
          return data.data?.csrfToken || data.csrfToken;
        } catch {
          return '';
        }
      };

      const csrfToken = await getCsrfToken();
      const mfaStatusRes = await fetch('/api/user/mfa');
      const mfaStatus = await mfaStatusRes.json();
      let mfaQrCode = '';
      
      if (!mfaStatus.enabled) {
        const setupRes = await fetch('/api/user/mfa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
          body: JSON.stringify({ method: 'totp' })
        });
        const setupData = await setupRes.json();
        
        if (setupData.qrCode) {
          mfaQrCode = setupData.qrCode;
        } else if (setupData.secret) {
           return { csrfToken, mfaSecretStr: setupData.secret, mfaQrCode: null };
        } else {
          return { error: 'Failed to get MFA QR Code' };
        }
      }
      return { csrfToken, mfaQrCode };
    })()
  `;

  const mfaInit = await page.evaluate(mfaSetupScript);
  if (mfaInit.error) throw new Error(mfaInit.error);

  let finalMfaSecret = mfaInit.mfaSecretStr;
  const csrfToken = mfaInit.csrfToken;

  if (mfaInit.mfaQrCode) {
    const image = await loadImage(mfaInit.mfaQrCode);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0, image.width, image.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    const qrCodeResult = jsQR(imageData.data, imageData.width, imageData.height);
    if (qrCodeResult) {
      const url = new URL(qrCodeResult.data);
      finalMfaSecret = url.searchParams.get('secret');
    } else {
      throw new Error(`[Session ${sessionId}] Failed to decode QR Code in node context`);
    }
  }

  // Step 2: Verify MFA if a new secret was generated
  if (finalMfaSecret) {
    console.log(`[Session ${sessionId}] [${email}] Setting up MFA verification...`);
    const token = speakeasy.totp({
      secret: finalMfaSecret,
      encoding: 'base32'
    });
    
    const verifyScript = `
      (async () => {
        const verifyRes = await fetch('/api/user/mfa', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'x-csrf-token': '${csrfToken}' },
          body: JSON.stringify({ code: '${token}' })
        });
        if (!verifyRes.ok) {
          return { error: 'Failed to verify MFA' };
        }
        return { success: true };
      })()
    `;
    const verifyRes = await page.evaluate(verifyScript);
    if (verifyRes.error) throw new Error(verifyRes.error);
    console.log(`[Session ${sessionId}] [${email}] MFA Enabled.`);
  }

  // Step 3: Create Person (if needed), Create Story, Approve Narration
  const title = `Stress Test Story - Session ${sessionId} - ${Date.now()}`;
  const content = `This is a generated story for stress testing the TTS endpoint. It was created by session ${sessionId} (${email}) at ${new Date().toISOString()}. The purpose is to ensure the system scales up properly and maintains stability under concurrent load.`;

  const createScript = `
    (async () => {
      let activeSubjectId;
      const resPeople = await fetch('/api/people');
      const dataPeople = await resPeople.json();
      activeSubjectId = dataPeople.data?.people?.[0]?.id || dataPeople.data?.[0]?.id;

      if (!activeSubjectId) {
        const createPersonRes = await fetch('/api/people', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-csrf-token': '${csrfToken}' },
          body: JSON.stringify({
            firstName: 'TestUser${sessionId}',
            lastName: 'StressTest',
          })
        });
        const personData = await createPersonRes.json();
        if (!personData.success) {
          return { error: 'Failed to create person: ' + JSON.stringify(personData) };
        }
        activeSubjectId = personData.data.id;
      }

      // Ensure the subject has a voice profile so the frontend TTS button is enabled
      const vpRes = await fetch('/api/voice/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': '${csrfToken}' },
        body: JSON.stringify({
          name: 'Stress Test Voice',
          personId: activeSubjectId,
          voiceId: 'mock-voice-id-for-stress-test',
          description: 'A mock voice profile created for stress testing.'
        })
      });
      if (!vpRes.ok) {
        console.error("Warning: Failed to create dummy voice profile", await vpRes.text());
      }

      const createRes = await fetch('/api/stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': '${csrfToken}' },
        body: JSON.stringify({
          title: ${JSON.stringify(title)},
          content: ${JSON.stringify(content)},
          subjectId: activeSubjectId,
          authorRelationship: 'Self',
          storyType: 'MEMORY',
          status: 'PUBLISHED',
          visibility: 'FAMILY_ONLY'
        })
      });
      const createData = await createRes.json();
      if (!createData.success) {
        return { error: 'Failed to create story: ' + JSON.stringify(createData) };
      }
      const createdId = createData.data.id;

      const patchRes = await fetch('/api/stories/' + createdId + '/narration', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': '${csrfToken}' },
        body: JSON.stringify({ action: 'approve', narratedContent: ${JSON.stringify(content)} })
      });
      
      if (!patchRes.ok) {
        return { error: 'Failed to approve narration' };
      }

      return { id: createdId };
    })()
  `;

  const createRes = await page.evaluate(createScript);
  if (createRes.error) throw new Error(createRes.error);
  const createdStoryId = createRes.id;


  console.log(`[Session ${sessionId}] [${email}] Story created (ID: ${createdStoryId}) and approved. Navigating to player...`);

  await page.goto(`${BASE_URL}/stories/${createdStoryId}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const generateBtn = page.getByRole('button', { name: /prepare.*play/i }).first();
  
  if (await generateBtn.isVisible()) {
    await generateBtn.click();
    console.log(`[Session ${sessionId}] [${email}] Narration generation triggered! Waiting for completion...`);
    
    try {
      const downloadBtn = page.getByRole('link', { name: /download/i }).first();
      await downloadBtn.waitFor({ state: 'visible', timeout: 180000 }); // Wait up to 3 minutes
      console.log(`[Session ${sessionId}] [${email}] Audio generation completed successfully!`);
    } catch (err) {
      console.log(`[Session ${sessionId}] [${email}] Timed out waiting for audio to finish.`);
    }
  } else {
    console.log(`[Session ${sessionId}] [${email}] Could not find the Prepare & Play button.`);
  }
}

async function runSession(browser: Browser, email: string, sessionId: number) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const startTime = performance.now();

  try {
    await signupAndOnboard(page, email, sessionId);
    await createStoryAndGenerateAudio(page, email, sessionId);
  } catch (err) {
    console.error(`[Session ${sessionId}] [${email}] Error:`, err);
  } finally {
    await context.close();
    const durationMs = performance.now() - startTime;
    const durationSec = (durationMs / 1000).toFixed(2);
    console.log(`✅ [Session ${sessionId}] [${email}] Finished in ${durationSec} seconds.`);
  }
}

async function main() {
  console.log(`Starting stress test with 5 concurrent accounts hitting ${BASE_URL}...`);
  const browser = await chromium.launch({ headless: true });
  const globalStartTime = performance.now();

  const tasks = TEST_ACCOUNTS.map((email, index) => {
    const sessionId = index + 1;
    const stagger = new Promise(resolve => setTimeout(resolve, sessionId * 1500));
    return stagger.then(() => runSession(browser, email, sessionId));
  });

  await Promise.all(tasks);
  await browser.close();
  
  const globalDurationSec = ((performance.now() - globalStartTime) / 1000).toFixed(2);
  console.log(`\n🎉 Stress test completed in a total of ${globalDurationSec} seconds.`);
}

main().catch(console.error);
