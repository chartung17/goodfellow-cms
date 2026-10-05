import { open, readdir, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { type ImageSize, imageSize, MEDIA_DIR } from "./index.js";

const IMAGE_EXTENSIONS = /\.(png|jpe?g|gif|webp|svg)$/i;

/** Enough of a file to find its size, unless a JPEG has a large block of details before its frame. */
const HEADER_BYTES = 64 * 1024;

const cache = new Map<string, { modified: number; size: ImageSize | undefined }>();

async function readHeader(file: string, length: number): Promise<Uint8Array> {
  const handle = await open(file, "r");
  try {
    const buffer = new Uint8Array(length);
    const { bytesRead } = await handle.read(buffer, 0, length, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

async function sizeOf(file: string): Promise<ImageSize | undefined> {
  const { mtimeMs, size: bytes } = await stat(file);
  const cached = cache.get(file);
  if (cached?.modified === mtimeMs) return cached.size;
  let size = imageSize(await readHeader(file, HEADER_BYTES));
  if (!size && bytes > HEADER_BYTES) size = imageSize(await readHeader(file, bytes));
  cache.set(file, { modified: mtimeMs, size });
  return size;
}

/**
 * The sizes of the images in a site's `public/media/`, by address
 * (`/media/photo.jpg`). Files are only read again once they've changed.
 */
export async function readMediaSizes(root: string): Promise<Record<string, ImageSize>> {
  const dir = join(root, MEDIA_DIR);
  let files: string[];
  try {
    files = (await readdir(dir, { recursive: true, withFileTypes: true }))
      .filter((entry) => entry.isFile() && IMAGE_EXTENSIONS.test(entry.name))
      .map((entry) => join(entry.parentPath, entry.name));
  } catch {
    return {};
  }
  const sizes: Record<string, ImageSize> = {};
  await Promise.all(
    files.map(async (file) => {
      const size = await sizeOf(file).catch(() => undefined);
      if (size) sizes[`/${relative(join(root, "public"), file).split(sep).join("/")}`] = size;
    }),
  );
  return sizes;
}
