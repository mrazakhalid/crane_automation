import jsQR from 'jsqr';

/** Load an image URL into an HTMLImageElement. */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read that image file'));
    img.src = url;
  });
}

/** Draw an image onto a canvas (down-scaled for performance) and read its pixels. */
function toImageData(img: HTMLImageElement): ImageData {
  const MAX = 1600;
  const scale = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight, 1));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not supported in this browser');
  ctx.drawImage(img, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}

/**
 * Decode a QR code from an image file (fully client-side).
 *
 * Args: file — an image file (png/jpg/…) containing a QR code.
 * Returns: The string encoded in the QR code.
 * Raises: Error if the file isn't an image, can't be read, or has no QR code.
 */
export async function decodeQrFromFile(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file');
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const { data, width, height } = toImageData(img);
    const result = jsQR(data, width, height, { inversionAttempts: 'attemptBoth' });
    if (!result?.data) throw new Error('No QR code found in that image');
    return result.data;
  } finally {
    URL.revokeObjectURL(url);
  }
}
