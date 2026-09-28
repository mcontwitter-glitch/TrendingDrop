/**
 * Browser-side cover compression for Create Story uploads.
 * Produces a small JPEG data URL suitable for localStorage / meta registry.
 */

export interface CompressCoverOptions {
  /** Max width or height in px (default 512). */
  maxDim?: number
  /** JPEG quality 0–1 (default 0.72). */
  quality?: number
  /** Soft cap on data-URL length; quality steps down if exceeded (default ~120KB binary ≈ 160k chars). */
  maxDataUrlChars?: number
}

const DEFAULT_MAX_DIM = 512
const DEFAULT_QUALITY = 0.72
const DEFAULT_MAX_CHARS = 160_000

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not decode image'))
    }
    img.src = url
  })
}

function canvasToJpegDataUrl(
  canvas: HTMLCanvasElement,
  quality: number,
): string {
  return canvas.toDataURL('image/jpeg', quality)
}

/**
 * Resize + JPEG-compress a File/Blob into a data URL.
 * Falls back to reading the original as data URL if canvas is unavailable.
 */
export async function compressCoverToDataUrl(
  file: File,
  opts: CompressCoverOptions = {},
): Promise<string> {
  const maxDim = opts.maxDim ?? DEFAULT_MAX_DIM
  const maxChars = opts.maxDataUrlChars ?? DEFAULT_MAX_CHARS
  let quality = opts.quality ?? DEFAULT_QUALITY

  if (typeof document === 'undefined') {
    return fileToDataUrl(file)
  }

  const img = await loadImage(file)
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
  const w = Math.max(1, Math.round(img.width * scale))
  const h = Math.max(1, Math.round(img.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return fileToDataUrl(file)
  ctx.fillStyle = '#030a16'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(img, 0, 0, w, h)

  let dataUrl = canvasToJpegDataUrl(canvas, quality)
  while (dataUrl.length > maxChars && quality > 0.4) {
    quality -= 0.08
    dataUrl = canvasToJpegDataUrl(canvas, quality)
  }
  return dataUrl
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Failed to read image file'))
    reader.readAsDataURL(file)
  })
}

/** Public path for a story cover served from GitHub Pages `public/meta/covers/`. */
export function coverPublicPath(storyPubkey: string, ext = 'jpg'): string {
  return `/meta/covers/${storyPubkey}.${ext}`
}
