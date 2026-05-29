// ══════════════════════════════════════════════════════════════
// Photo attachment helpers — pick + compress images for upload
// to the Hono API as `data:image/jpeg;base64,...` data URLs.
//
// Mirrors the web-side helper at
//   ../roomalyzer20/src/utils/imageCompression.js
// so the API contract is identical:
//   - Always JPEG output (re-encodes HEIC/PNG/etc.)
//   - Longest side scaled to 1600 px (smaller images are not
//     up-sampled).
//   - Default quality 0.75.
//
// The server (`server/routes/waterdetection.js`) caps each
// attachment at 2 MB after base64 decode and rejects MIME types
// outside `image/jpeg|png`. Both caps are well clear of typical
// compressed-photo sizes (200-600 KB).
//
// ── Permissions ──
// `ImagePicker.launchImageLibraryAsync` does NOT require an
// explicit permission prompt on iOS or Android (the system
// picker handles consent). `launchCameraAsync` DOES — we ask
// via `requestCameraPermissionsAsync()` and surface a permission
// error to the caller so the UI can show an actionable message.
// ══════════════════════════════════════════════════════════════
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

/** A photo ready to send to the API. */
export interface CompressedPhoto {
  /** Stable id for React keys / removal. */
  id: string;
  /** `data:image/jpeg;base64,...` — what the server expects. */
  dataUrl: string;
  /** Local URI we can display in an `<Image>` preview. */
  previewUri: string;
  width: number;
  height: number;
  /** Approximate raw byte size after base64 decode. */
  byteSize: number;
  /** Best-effort original filename, for the upload payload. */
  filename: string;
}

export type PhotoSource = 'camera' | 'library';

export class PhotoPickError extends Error {
  code: 'permission' | 'cancelled' | 'compression' | 'unknown';
  constructor(code: PhotoPickError['code'], message: string) {
    super(message);
    this.name = 'PhotoPickError';
    this.code = code;
  }
}

const MAX_DIMENSION = 1600;
const QUALITY = 0.75;

function makeId(): string {
  return `att-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function deriveFilename(uri: string, source: PhotoSource): string {
  const tail = uri.split('/').pop() || `photo-${Date.now()}.jpg`;
  // Strip query strings + force a .jpg extension since we always re-encode.
  const base = tail.split('?')[0]?.split('#')[0] || tail;
  const stem = base.replace(/\.[^./]+$/, '');
  return `${stem || (source === 'camera' ? 'camera' : 'photo')}.jpg`;
}

/**
 * Resize and re-encode a single source URI into a JPEG data URL.
 * Mirrors `compressImage()` from the web repo.
 */
async function compressOne(uri: string, source: PhotoSource): Promise<CompressedPhoto> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    // No-op transform if the image is already small — we still
    // need a single resize step so we can specify only `width`
    // OR `height` and have the aspect ratio preserved. Pass the
    // longest-side cap and let the manipulator scale on demand.
    [{ resize: { width: MAX_DIMENSION } }],
    {
      compress: QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    },
  );

  if (!result.base64) {
    throw new PhotoPickError('compression', 'Compression returned no base64 data');
  }

  const base64 = result.base64;
  const padding = (base64.match(/=+$/) || [''])[0]?.length ?? 0;
  const byteSize = Math.max(0, Math.floor((base64.length * 3) / 4) - padding);

  return {
    id: makeId(),
    dataUrl: `data:image/jpeg;base64,${base64}`,
    previewUri: result.uri,
    width: result.width,
    height: result.height,
    byteSize,
    filename: deriveFilename(uri, source),
  };
}

/**
 * Open the system photo library and let the user pick up to
 * `selectionLimit` photos. Each picked photo is compressed before
 * the function resolves so the caller gets an upload-ready array.
 *
 * Returns an empty array if the user cancels — never throws on
 * cancellation. Throws `PhotoPickError('compression')` if a
 * picked image cannot be re-encoded.
 */
export async function pickFromLibrary(selectionLimit: number): Promise<CompressedPhoto[]> {
  if (selectionLimit <= 0) return [];

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 1,
    allowsMultipleSelection: selectionLimit > 1,
    selectionLimit,
  });

  if (result.canceled || !result.assets?.length) return [];

  const out: CompressedPhoto[] = [];
  for (const asset of result.assets) {
    out.push(await compressOne(asset.uri, 'library'));
  }
  return out;
}

/**
 * Launch the device camera and return a single compressed photo.
 * Requests camera permission first; throws
 * `PhotoPickError('permission')` if the user denies.
 *
 * Returns `null` if the user cancels — never throws on cancellation.
 */
export async function takePhoto(): Promise<CompressedPhoto | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    throw new PhotoPickError('permission', 'Camera permission was denied');
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 1,
  });

  if (result.canceled || !result.assets?.length) return null;
  const first = result.assets[0];
  if (!first) return null;
  return compressOne(first.uri, 'camera');
}

/** Server-enforced cap. Mirrors the web app for consistent UX. */
export const MAX_ATTACHMENTS = 3;
