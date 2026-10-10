/** An image's size in pixels. */
export interface ImageSize {
  width: number;
  height: number;
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(start, start + length));
}

function pngSize(bytes: Uint8Array, view: DataView): ImageSize | undefined {
  if (bytes.length < 24 || ascii(bytes, 1, 3) !== "PNG" || ascii(bytes, 12, 4) !== "IHDR") return undefined;
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function gifSize(bytes: Uint8Array, view: DataView): ImageSize | undefined {
  if (bytes.length < 10 || !/^GIF8[79]a$/.test(ascii(bytes, 0, 6))) return undefined;
  return { width: view.getUint16(6, true), height: view.getUint16(8, true) };
}

/** Reads the frame header (SOF), skipping other segments. */
function jpegSize(bytes: Uint8Array, view: DataView): ImageSize | undefined {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return undefined;
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) return undefined;
    const marker = bytes[offset + 1] ?? 0;
    const length = view.getUint16(offset + 2);
    const isFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isFrame) return { width: view.getUint16(offset + 7), height: view.getUint16(offset + 5) };
    offset += 2 + length;
  }
  return undefined;
}

function webpSize(bytes: Uint8Array, view: DataView): ImageSize | undefined {
  if (bytes.length < 30 || ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WEBP") return undefined;
  const chunk = ascii(bytes, 12, 4);
  const at = (index: number) => bytes[index] ?? 0;
  if (chunk === "VP8X") {
    return {
      width: 1 + (at(24) | (at(25) << 8) | (at(26) << 16)),
      height: 1 + (at(27) | (at(28) << 8) | (at(29) << 16)),
    };
  }
  if (chunk === "VP8 ") return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
  if (chunk === "VP8L") {
    return {
      width: 1 + (((at(22) & 0x3f) << 8) | at(21)),
      height: 1 + (((at(24) & 0x0f) << 10) | (at(23) << 2) | ((at(22) & 0xc0) >> 6)),
    };
  }
  return undefined;
}

/** A length in an SVG's width or height, in pixels; percentages and other units can't be known. */
function svgLength(value: string | undefined): number | undefined {
  const match = value && /^(\d+(?:\.\d+)?)(?:\s*px)?$/.exec(value.trim());
  return match ? Number(match[1]) : undefined;
}

function svgSize(bytes: Uint8Array): ImageSize | undefined {
  const text = new TextDecoder().decode(bytes.subarray(0, 4096));
  const tag = /<svg\b[^>]*>/i.exec(text)?.[0];
  if (!tag) return undefined;
  const attribute = (name: string) => new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`, "i").exec(tag)?.[1];
  const width = svgLength(attribute("width"));
  const height = svgLength(attribute("height"));
  if (width && height) return { width, height };
  const box = attribute("viewBox")
    ?.trim()
    .split(/[\s,]+/)
    .map(Number);
  if (box?.length === 4 && box.every(Number.isFinite) && (box[2] ?? 0) > 0 && (box[3] ?? 0) > 0) {
    const [, , boxWidth = 0, boxHeight = 0] = box;
    if (width) return { width, height: (width * boxHeight) / boxWidth };
    if (height) return { width: (height * boxWidth) / boxHeight, height };
    return { width: boxWidth, height: boxHeight };
  }
  return undefined;
}

/**
 * The size of a PNG, JPEG, GIF, WebP or SVG image, read from the start of its
 * file, or `undefined` for other formats and files it can't read.
 */
export function imageSize(bytes: Uint8Array): ImageSize | undefined {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  try {
    const size =
      pngSize(bytes, view) ?? gifSize(bytes, view) ?? jpegSize(bytes, view) ?? webpSize(bytes, view) ?? svgSize(bytes);
    return size && size.width > 0 && size.height > 0 ? size : undefined;
  } catch {
    // A truncated file reads past its end.
    return undefined;
  }
}
