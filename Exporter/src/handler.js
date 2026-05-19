const express = require('express');
const puppeteer = require('puppeteer');
const sharp = require('sharp');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const dotenv = require('dotenv');
const crypto = require('crypto');
const fs = require('fs');

dotenv.config();

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

async function renderAndStitchTree(url, sessionCookie = '') {
  let browser;
  try {
    console.log(`Starting headless browser to visit: ${url}`);
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--hide-scrollbars',
      ],
    });

    const page = await browser.newPage();
    // Set a very large viewport to allow the tree to render unconstrained
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 2 });

    // Apply the forwarded session cookie so the export page can authenticate its API calls.
    if (sessionCookie) {
      const eqIdx = sessionCookie.indexOf('=');
      // Strip __Secure- prefix: Puppeteer visits HTTP so Chromium rejects __Secure- cookies,
      // and the Next.js server on a plain HTTP connection looks for the un-prefixed name.
      const rawName = sessionCookie.slice(0, eqIdx).trim();
      const name = rawName.replace(/^__Secure-/, '');
      const value = sessionCookie.slice(eqIdx + 1).trim();
      const { hostname } = new URL(url);
      await page.setCookie({ name, value, domain: hostname, path: '/' });
      console.log(`Set session cookie "${name}" for domain: ${hostname}`);
    }

    await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });

    // Wait for the tree to signal it is fully rendered and layout is calculated
    console.log('Waiting for IS_TREE_READY signal...');
    await page.waitForFunction('window.IS_TREE_READY === true', { timeout: 60000 });

    // Get the exact dimensions of the tree
    const bounds = await page.evaluate(() => window.TREE_BOUNDS);
    if (!bounds) {
      throw new Error('Failed to extract TREE_BOUNDS from the page.');
    }

    console.log(`Extracted Bounds: X=${bounds.x}, Y=${bounds.y}, W=${bounds.width}, H=${bounds.height}`);

    const PADDING = 120;
    const unscaledWidth = bounds.width + PADDING * 2;
    const unscaledHeight = bounds.height + PADDING * 2;

    const TILE_SIZE = 2000;
    const cols = Math.ceil(unscaledWidth / TILE_SIZE);
    const rows = Math.ceil(unscaledHeight / TILE_SIZE);

    console.log(`Planning ${cols * rows} tiles (${cols}x${rows}) for ${unscaledWidth}x${unscaledHeight} tree.`);

    // Adjust the React Flow viewport to center exactly at 0,0 for our coordinate system
    await page.evaluate((b, p) => {
      const viewport = document.querySelector('.react-flow__viewport');
      if (viewport) {
        // Shift it so bounds.x and bounds.y are at the absolute top-left with padding
        viewport.style.transform = `translate(${-(b.x - p)}px, ${-(b.y - p)}px) scale(1)`;
      }
      // Set the body size so we can take massive screenshots without clipping
      document.body.style.width = '100000px';
      document.body.style.height = '100000px';
    }, bounds, PADDING);

    // Wait for the transform to apply
    await new Promise(r => setTimeout(r, 500));

    // Prepare Sharp canvas
    // 2x Retina Resolution
    const physicalWidth = unscaledWidth * 2;
    const physicalHeight = unscaledHeight * 2;
    const TILE_PHYSICAL = TILE_SIZE * 2;

    const compositeOperations = [];

    // Capture tiles
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const tileX = col * TILE_SIZE;
        const tileY = row * TILE_SIZE;
        
        const tWidth = Math.min(TILE_SIZE, unscaledWidth - tileX);
        const tHeight = Math.min(TILE_SIZE, unscaledHeight - tileY);

        console.log(`Capturing tile ${col},${row}...`);
        
        // Take exact screenshot of this chunk
        const tileBuffer = await page.screenshot({
          clip: {
            x: tileX,
            y: tileY,
            width: tWidth,
            height: tHeight,
          },
          omitBackground: true,
        });

        compositeOperations.push({
          input: tileBuffer,
          top: tileY * 2, // 2x physical
          left: tileX * 2,
        });
      }
    }

    await browser.close();

    console.log(`Stitching ${compositeOperations.length} tiles via sharp...`);

    const finalBuffer = await sharp({
      create: {
        width: physicalWidth,
        height: physicalHeight,
        channels: 4,
        background: { r: 246, g: 243, b: 238, alpha: 1 }
      }
    })
      .composite(compositeOperations)
      .png()
      .toBuffer();

    return finalBuffer;
  } catch (err) {
    if (browser) await browser.close();
    throw err;
  }
}

async function processImageOutput(buffer) {
  const fileName = `family-tree-${crypto.randomUUID()}.png`;
  
  // Local saving for testing
  if (process.env.SAVE_LOCAL === 'true') {
    const localDir = '/app/output';
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    const filePath = `${localDir}/${fileName}`;
    fs.writeFileSync(filePath, buffer);
    console.log(`Saved locally to ${filePath}`);

    // Use the public base URL passed from the API so the browser download uses the correct
    // protocol (https) and host rather than a hardcoded http:// URL.
    const baseUrl = (globalThis._publicBaseUrl || 'https://localhost:4777').replace(/\/$/, '');
    return `${baseUrl}/exports/${fileName}`;
  }

  // Cloudflare R2 Upload
  const fileKey = `exports/${fileName}`;
  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: fileKey,
    Body: buffer,
    ContentType: 'image/png',
  });

  await s3Client.send(command);
  
  // Note: For R2, you must configure a custom domain on your bucket for public access
  // or use an R2 worker. Replace this with your actual R2 public domain.
  const publicDomain = process.env.R2_PUBLIC_DOMAIN || `https://pub-${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.dev`;
  return `${publicDomain}/${fileKey}`;
}

const app = express();
app.use(express.json());

app.post(['/', '/run', '/start'], async (req, res) => {
  try {
    const input = req.body?.input || req.body;
    if (!input || !input.url) {
      return res.status(400).json({ error: 'Missing target URL in input.' });
    }

    console.log(`Received job for URL: ${input.url}`);

    // Make publicBaseUrl available to processImageOutput without threading it through every call
    globalThis._publicBaseUrl = input.publicBaseUrl || '';

    // 1. Render and Stitch
    const imageBuffer = await renderAndStitchTree(input.url, input.sessionCookie || '');
    
    // 2. Upload to R2 or Save Locally
    console.log(`Processing ${Math.round(imageBuffer.length / 1024 / 1024)} MB PNG...`);
    const downloadUrl = await processImageOutput(imageBuffer);

    console.log(`Success! URL: ${downloadUrl}`);

    // RunPod custom containers should return the result directly
    return res.status(200).json({
      status: 'COMPLETED',
      output: {
        success: true,
        downloadUrl,
      }
    });
  } catch (error) {
    console.error('Job failed:', error);
    return res.status(500).json({
      status: 'FAILED',
      error: error.message || String(error),
    });
  }
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`RunPod Node.js Worker listening on port ${PORT}`);
});
