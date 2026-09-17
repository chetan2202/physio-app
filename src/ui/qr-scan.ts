// Decode a QR code from an uploaded image file (WhatsApp image / gallery screenshot, per R79).
// Camera live-scan is intentionally not used — patients and staff receive a saved image.

import jsQR from "jsqr";

export async function codeFromImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not read the image.");
  ctx.drawImage(bitmap, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const found = jsQR(data, width, height);
  if (!found?.data) throw new Error("No QR code found in that image. Try a clearer photo or screenshot.");
  return found.data;
}
