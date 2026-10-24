// image.js — reduce la foto del cuaderno en el navegador antes de enviarla al escáner.
// Una foto de celular pesa 3–8 MB; aquí se escala a ≤1280 px y se comprime a JPEG para que viaje rápido
// y barato. Las dependencias del navegador (decodificar/dibujar) se inyectan para poder probarlo.

export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_B64 = 1_500_000; // debe quedar por debajo del límite del servidor (1_600_000)

export class ImageError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

async function browserLoad(file) {
  if (typeof createImageBitmap === 'function') {
    const bmp = await createImageBitmap(file);
    return { width: bmp.width, height: bmp.height, source: bmp, release: () => bmp.close?.() };
  }
  const url = URL.createObjectURL(file);
  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error('decode'));
    i.src = url;
  });
  return { width: img.naturalWidth, height: img.naturalHeight, source: img, release: () => URL.revokeObjectURL(url) };
}

function browserEncode(source, w, h, quality) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; // fondo blanco: los PNG con transparencia no salen negros
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(source, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', quality).split(',')[1] ?? '';
}

/** @returns {Promise<{ mediaType:'image/jpeg', data:string, width:number, height:number }>} */
export async function prepareImage(file, { maxSide = 1280, load = browserLoad, encode = browserEncode } = {}) {
  if (!file || !/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type || '')) throw new ImageError('not_image');
  if (file.size > MAX_FILE_BYTES) throw new ImageError('too_big');
  let img;
  try {
    img = await load(file);
  } catch {
    throw new ImageError('decode');
  }
  try {
    let side = maxSide;
    for (let attempt = 0; attempt < 4; attempt++) {
      const k = Math.min(1, side / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * k));
      const h = Math.max(1, Math.round(img.height * k));
      const data = encode(img.source, w, h, attempt === 0 ? 0.82 : 0.7);
      if (data && data.length <= MAX_B64) return { mediaType: 'image/jpeg', data, width: w, height: h };
      side = Math.round(side * 0.75); // todavía pesa mucho: se reduce más
    }
    throw new ImageError('too_big');
  } finally {
    img.release?.();
  }
}
