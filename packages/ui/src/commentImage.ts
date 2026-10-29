/**
 * Browser-only helper for `CommentThread` uploads: shrinks a large photo
 * before it leaves the device and reports its dimensions.
 *
 * Comment attachments travel through each app's server, whose request body is
 * capped (4.5 MB on Vercel). A phone photo is often bigger than that, so it is
 * redrawn at most 2560px on its long side as JPEG. GIFs (animation) and HEIC
 * (browsers cannot decode it) are sent untouched.
 */

export interface PreparedCommentFile {
  file: File;
  width: number | null;
  height: number | null;
}

const RESIZABLE = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_SIDE = 2560;
const SHRINK_ABOVE_BYTES = 1.5 * 1024 * 1024;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image_decode_failed'));
    };
    img.src = url;
  });
}

export async function prepareCommentFile(file: File): Promise<PreparedCommentFile> {
  if (!RESIZABLE.has(file.type) || typeof document === 'undefined') {
    return { file, width: null, height: null };
  }
  let img: HTMLImageElement;
  try {
    img = await loadImage(file);
  } catch {
    return { file, width: null, height: null };
  }
  const width = img.naturalWidth;
  const height = img.naturalHeight;
  const longSide = Math.max(width, height);
  if (file.size <= SHRINK_ABOVE_BYTES && longSide <= MAX_SIDE) {
    return { file, width, height };
  }

  const scale = Math.min(1, MAX_SIDE / longSide);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return { file, width, height };
  // JPEG has no alpha: paint white under transparent PNGs instead of black.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  if (!blob || blob.size >= file.size) return { file, width, height };
  const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
  return {
    file: new File([blob], name, { type: 'image/jpeg', lastModified: file.lastModified }),
    width: canvas.width,
    height: canvas.height,
  };
}
