#!/usr/bin/env node
/**
 * BetterCord Icon Generator
 * 
 * Generates all PWA + Apple touch icons from the BC SVG source.
 * 
 * Requirements:
 *   npm install --save-dev sharp
 * 
 * Usage:
 *   node scripts/generate-icons.js
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SVG_SRC = path.resolve(__dirname, '../public/res/svg/bettercord-icon.svg');

// hsl(242, 70%, 55%) = #413CDD — Fluxer brand color
const BRAND_BG = '#413CDD';
const TEXT_COLOR = '#ffffff';

// ── Inline SVG (same as bettercord-icon.svg) ──────────────────────────────
function makeSvg(size) {
  const radius = Math.round(size * 0.254); // ~30% for squircle feel
  const pad = Math.round(size * 0.078);
  const inner = size - pad * 2;
  const fontSize = Math.round(size * 0.41);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${BRAND_BG}"/>
  <rect x="${pad}" y="${pad}" width="${inner}" height="${inner}" rx="${radius}" ry="${radius}" fill="${BRAND_BG}"/>
  <text x="${size / 2}" y="${size / 2}" text-anchor="middle" dominant-baseline="central"
    font-family="system-ui,-apple-system,sans-serif" font-size="${fontSize}" font-weight="700"
    letter-spacing="${Math.round(-size * 0.016)}" fill="${TEXT_COLOR}">BC</text>
</svg>`);
}

// Android sizes
const ANDROID_SIZES = [36, 48, 72, 96, 144, 192, 256, 384, 512];
const ANDROID_DIR = path.resolve(__dirname, '../public/res/android');

// Apple sizes
const APPLE_SIZES = [57, 60, 72, 76, 114, 120, 144, 152, 167, 180];
const APPLE_DIR = path.resolve(__dirname, '../public/res/apple');

async function generate() {
  console.log('Generating BetterCord icons...\n');

  // Android
  for (const size of ANDROID_SIZES) {
    const out = path.join(ANDROID_DIR, `android-chrome-${size}x${size}.png`);
    await sharp(makeSvg(size)).resize(size, size).png().toFile(out);
    console.log(`  ✓ android-chrome-${size}x${size}.png`);
  }

  // Maskable variants (same content — full bleed is already handled by SVG)
  for (const size of [192, 512]) {
    const out = path.join(ANDROID_DIR, `android-chrome-${size}x${size}-maskable.png`);
    await sharp(makeSvg(size)).resize(size, size).png().toFile(out);
    console.log(`  ✓ android-chrome-${size}x${size}-maskable.png`);
  }

  // Apple touch icons (iOS requires PNG, no SVG support)
  for (const size of APPLE_SIZES) {
    // Apple needs rounded corners baked in (iOS clips to circle anyway, but squircle looks better)
    const out = path.join(APPLE_DIR, `apple-touch-icon-${size}x${size}.png`);
    await sharp(makeSvg(size)).resize(size, size).png().toFile(out);
    console.log(`  ✓ apple-touch-icon-${size}x${size}.png`);
  }

  // Favicon 32x32 (overwrites existing favicon with brand version)
  const faviconDir = path.resolve(__dirname, '../public');
  // Note: .ico format requires a separate tool; generate a 32x32 PNG as fallback
  const favicon32 = path.join(faviconDir, 'favicon-32x32.png');
  await sharp(makeSvg(32)).resize(32, 32).png().toFile(favicon32);
  console.log(`  ✓ favicon-32x32.png`);

  console.log('\nAll icons generated successfully!');
  console.log('Run: npm run build — to include them in the dist.');
}

generate().catch((err) => {
  console.error('Icon generation failed:', err.message);
  console.error('\nMake sure sharp is installed:');
  console.error('  npm install --save-dev sharp');
  process.exit(1);
});
