/**
 * Generate PWA icons from the Bright Beginnings coral bird mark.
 *
 * Source: public/brand/bird-coral.png (1500x1500, RGBA — transparent surround).
 * Output: public/icons/*.png (committed to the repo; run once, or re-run if the
 * mark ever changes). Requires `sharp` (installed with --no-save — see handover).
 *
 *   node scripts/genPwaIcons.mjs
 *
 * Sizes / purposes match the manifest in vite.config.ts:
 *   pwa-192.png            192  purpose "any"       (bird, transparent bg)
 *   pwa-512.png            512  purpose "any"       (bird, transparent bg)
 *   pwa-512-maskable.png   512  purpose "maskable"  (bird in ~64% safe zone on cream)
 *   apple-touch-icon-180.png 180 iOS home screen    (bird on cream — iOS drops alpha)
 */
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'

const SRC = 'public/brand/bird-coral.png'
const OUT = 'public/icons'
const CREAM = { r: 250, g: 250, b: 245, alpha: 1 } // #fafaf5 — app --background
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 }

await mkdir(OUT, { recursive: true })

/** Trim the transparent margin, then fit the bird into `scale` of a `size` square. */
async function birdAt(size, scale) {
  const inner = Math.round(size * scale)
  return sharp(SRC)
    .trim()
    .resize(inner, inner, { fit: 'contain', background: CLEAR })
    .toBuffer()
}

async function compose(size, scale, background, file) {
  const bird = await birdAt(size, scale)
  await sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: bird, gravity: 'center' }])
    .png()
    .toFile(`${OUT}/${file}`)
  console.log('  ✓', file)
}

console.log('Generating PWA icons from', SRC)
// Standard maskable=any icons: mark near-full-bleed on transparency.
await compose(192, 0.92, CLEAR, 'pwa-192.png')
await compose(512, 0.92, CLEAR, 'pwa-512.png')
// Maskable: mark pulled into the ~64% safe zone on an opaque cream fill so Android
// masks (circle / squircle / rounded-square) never clip the beak, tail, or legs.
await compose(512, 0.64, CREAM, 'pwa-512-maskable.png')
// Apple touch icon: iOS ignores transparency and rounds corners itself → cream fill.
await compose(180, 0.72, CREAM, 'apple-touch-icon-180.png')
console.log('Done →', OUT)
