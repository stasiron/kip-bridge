const MAX_BYTES = 380_000;
const MAX_EDGE = 640;
const JPEG_QUALITY_STEPS = [0.82, 0.7, 0.58, 0.46, 0.34];

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image"));
    };
    image.src = url;
  });
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error("JPEG encode failed"));
        else resolve(blob);
      },
      "image/jpeg",
      quality,
    );
  });
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/**
 * File-input / capture path for Safari on plain HTTP.
 * Does not use getUserMedia (needs secure context).
 */
export async function fileToJpegBase64(file: File): Promise<{ base64: string; bytes: number }> {
  const image = await loadImage(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(image, 0, 0, width, height);

  for (const quality of JPEG_QUALITY_STEPS) {
    const blob = await canvasToJpegBlob(canvas, quality);
    if (blob.size <= MAX_BYTES || quality === JPEG_QUALITY_STEPS[JPEG_QUALITY_STEPS.length - 1]) {
      if (blob.size > 400_000) throw new Error("Portrait still too large after compression");
      const base64 = await blobToBase64(blob);
      return { base64, bytes: blob.size };
    }
  }
  throw new Error("Portrait encode failed");
}
