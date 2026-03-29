/**
 * Sandboxed file processing script
 * Runs with minimal privileges and no network access
 */

const job = JSON.parse(process.argv[2])

// Restrict imports to only required modules
const sharp = require('sharp')
const fs = require('fs').promises

async function processImage() {
  const { inputPath, outputPath, options } = job
  
  // Validate paths are within allowed directories
  const allowedDirs = ['/tmp', '/app/uploads', '/app/processed']
  const isAllowed = allowedDirs.some(dir => 
    inputPath.startsWith(dir) && outputPath.startsWith(dir)
  )
  
  if (!isAllowed) {
    throw new Error('Path not in allowed directory')
  }
  
  // Set resource limits
  const maxPixels = 100_000_000 // 100MP
  const maxFileSize = 100 * 1024 * 1024 // 100MB
  
  await sharp(inputPath, {
    limitInputPixels: maxPixels,
    sequentialRead: true,
  })
    .resize(options.maxWidth || 2048, options.maxHeight || 2048, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: options.quality || 85, progressive: true })
    .toFile(outputPath)
  
  // Verify output file exists and is within size limits
  const stats = await fs.stat(outputPath)
  if (stats.size > maxFileSize) {
    await fs.unlink(outputPath)
    throw new Error('Output file too large')
  }
  
  return { outputPath }
}

processImage()
  .then(result => {
    console.log(JSON.stringify(result))
    process.exit(0)
  })
  .catch(error => {
    console.error(error.message)
    process.exit(1)
  })
