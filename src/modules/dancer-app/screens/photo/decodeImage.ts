import { MIN_SOURCE_EDGE, orientationToApply, orientedSize, readJpegSize, readOrientation, type Orientation } from './cropModel';

/** A decoded photo, ready for renderCrop(): `orientation` is what is STILL to apply. */
export type DecodedPhoto = {
  source: ImageBitmap;
  rawW: number;
  rawH: number;
  orientation: Orientation;
  /** Size after rotation: what the crop is measured in. */
  w: number;
  h: number;
};

export const TOO_SMALL_COPY = `That photo is too small to use. Choose one at least ${MIN_SOURCE_EDGE} pixels wide and tall.`;
export const CANNOT_READ_COPY = 'We could not open that photo. Choose a JPG, PNG or WebP photo instead.';

export class DecodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DecodeError';
  }
}

export type DecodeDeps = {
  createBitmap: (file: Blob, options: ImageBitmapOptions) => Promise<ImageBitmap>;
  readBytes: (file: Blob) => Promise<ArrayBuffer>;
};

export const browserDecodeDeps: DecodeDeps = {
  createBitmap: (file, options) => createImageBitmap(file, options),
  readBytes: (file) => file.arrayBuffer(),
};

/**
 * EXIF handling: ask the decoder to rotate (`imageOrientation: 'from-image'`); then
 * check the result against the JPEG header, and if a browser ignored the option for
 * a 5-8 photo, rotate it ourselves in renderCrop (orientationToApply).
 */
export const decodePhoto = async (file: Blob, deps: DecodeDeps = browserDecodeDeps): Promise<DecodedPhoto> => {
  let exif: Orientation = 1;
  let raw: { w: number; h: number } | null = null;
  try {
    const bytes = await deps.readBytes(file);
    exif = readOrientation(bytes);
    raw = readJpegSize(bytes);
  } catch {
    /* unreadable header: trust the decoder */
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await deps.createBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    try {
      bitmap = await deps.createBitmap(file, {});
    } catch {
      throw new DecodeError(CANNOT_READ_COPY);
    }
  }
  const orientation = orientationToApply(exif, { w: bitmap.width, h: bitmap.height }, raw);
  const { w, h } = orientedSize(bitmap.width, bitmap.height, orientation);
  if (Math.min(w, h) < MIN_SOURCE_EDGE) throw new DecodeError(TOO_SMALL_COPY);
  return { source: bitmap, rawW: bitmap.width, rawH: bitmap.height, orientation, w, h };
};
