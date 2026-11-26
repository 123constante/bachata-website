// Browser-only cut-out for the raffle winner photo (flag: raffleCutout).
// MediaPipe Tasks Vision is loaded lazily from its CDN, only on the photo step,
// so it never touches the app bundle. Any failure resolves to null and the
// caller keeps today's behaviour (upload the original).
const MP_VERSION = '0.10.14';
const MP_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}`;
const MODEL_BASE = 'https://storage.googleapis.com/mediapipe-models';
const SIZE = 800;

type Box = { originX: number; originY: number; width: number; height: number };
type Mp = {
  FilesetResolver: { forVisionTasks(path: string): Promise<unknown> };
  ImageSegmenter: { createFromOptions(fs: unknown, o: unknown): Promise<{ segment(i: ImageBitmap): { confidenceMasks?: Array<{ getAsFloat32Array(): Float32Array; close(): void }>; close?(): void } }> };
  FaceDetector: { createFromOptions(fs: unknown, o: unknown): Promise<{ detect(i: ImageBitmap): { detections: Array<{ boundingBox?: Box }> } }> };
};

let loading: Promise<{ seg: Awaited<ReturnType<Mp['ImageSegmenter']['createFromOptions']>>; face: Awaited<ReturnType<Mp['FaceDetector']['createFromOptions']>> }> | null = null;

function load() {
  if (!loading) {
    loading = (async () => {
      const mp = (await import(/* @vite-ignore */ `${MP_BASE}/vision_bundle.mjs`)) as Mp;
      const fs = await mp.FilesetResolver.forVisionTasks(`${MP_BASE}/wasm`);
      const seg = await mp.ImageSegmenter.createFromOptions(fs, {
        baseOptions: { modelAssetPath: `${MODEL_BASE}/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite` },
        outputConfidenceMasks: true,
        outputCategoryMask: false,
      });
      const face = await mp.FaceDetector.createFromOptions(fs, {
        baseOptions: { modelAssetPath: `${MODEL_BASE}/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite` },
      });
      return { seg, face };
    })();
    loading.catch(() => { loading = null; });
  }
  return loading;
}

// Square crop with the face centre in the upper third, head and shoulders in frame.
export function cropFor(w: number, h: number, face: Box): { sx: number; sy: number; side: number } {
  const side = Math.min(Math.max(face.width * 2.6, 64), Math.min(w, h) * 1.6);
  const cx = face.originX + face.width / 2;
  const cy = face.originY + face.height / 2;
  return { sx: cx - side / 2, sy: cy - side / 3, side };
}

export async function cutOutPerson(file: File): Promise<Blob | null> {
  try {
    const { seg, face } = await load();
    const bmp = await createImageBitmap(file);
    const box = face.detect(bmp).detections[0]?.boundingBox;
    const result = seg.segment(bmp);
    const mask = result.confidenceMasks?.[0];
    if (!box || !mask) return null;
    const conf = mask.getAsFloat32Array();
    const src = document.createElement('canvas');
    src.width = bmp.width;
    src.height = bmp.height;
    const sctx = src.getContext('2d');
    if (!sctx) return null;
    sctx.drawImage(bmp, 0, 0);
    const px = sctx.getImageData(0, 0, src.width, src.height);
    if (conf.length !== src.width * src.height) return null;
    let kept = 0;
    for (let i = 0; i < conf.length; i++) {
      const a = Math.max(0, Math.min(1, (conf[i] - 0.3) / 0.4));
      px.data[i * 4 + 3] = Math.round(a * 255);
      if (a > 0.5) kept++;
    }
    if (kept < conf.length * 0.03) return null;
    sctx.putImageData(px, 0, 0);
    mask.close();
    const { sx, sy, side } = cropFor(src.width, src.height, box);
    const out = document.createElement('canvas');
    out.width = SIZE;
    out.height = SIZE;
    const octx = out.getContext('2d');
    if (!octx) return null;
    octx.drawImage(src, sx, sy, side, side, 0, 0, SIZE, SIZE);
    return await new Promise<Blob | null>((res) => out.toBlob((b) => res(b), 'image/png'));
  } catch {
    return null;
  }
}
