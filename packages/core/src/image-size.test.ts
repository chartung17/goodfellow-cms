import { describe, expect, it } from "vitest";
import { imageSize } from "./image-size.js";

function bytes(...parts: Array<string | number[]>): Uint8Array {
  return new Uint8Array(
    parts.flatMap((part) => (typeof part === "string" ? [...part].map((c) => c.charCodeAt(0)) : part)),
  );
}

const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const le16 = (n: number) => [n & 255, (n >>> 8) & 255];

describe("imageSize", () => {
  it("reads PNG, GIF and JPEG headers", () => {
    expect(imageSize(bytes([0x89], "PNG", [13, 10, 26, 10], be32(13), "IHDR", be32(640), be32(480)))).toEqual({
      width: 640,
      height: 480,
    });
    expect(imageSize(bytes("GIF89a", le16(32), le16(16)))).toEqual({ width: 32, height: 16 });
    const app0 = [0xff, 0xe0, 0, 4, 0, 0];
    const sof0 = [0xff, 0xc0, 0, 17, 8, 0x04, 0x38, 0x07, 0x80, 3];
    expect(imageSize(bytes([0xff, 0xd8], app0, sof0))).toEqual({ width: 1920, height: 1080 });
  });

  it("reads extended WebP headers", () => {
    const size = [0x7f, 0x02, 0x00, 0xdf, 0x01, 0x00]; // 640 × 480, stored minus one
    expect(imageSize(bytes("RIFF", [0, 0, 0, 0], "WEBPVP8X", [10, 0, 0, 0], [0, 0, 0, 0], size))).toEqual({
      width: 640,
      height: 480,
    });
  });

  it("reads SVGs' sizes, or their viewBox", () => {
    expect(imageSize(bytes('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="32">'))).toEqual({
      width: 64,
      height: 32,
    });
    expect(imageSize(bytes('<?xml version="1.0"?><svg viewBox="0 0 1200 675">'))).toEqual({ width: 1200, height: 675 });
    expect(imageSize(bytes('<svg width="100%" height="100%">'))).toBeUndefined();
  });

  it("gives up on other and broken files", () => {
    expect(imageSize(bytes("%PDF-1.4"))).toBeUndefined();
    expect(imageSize(bytes([0x89], "PNG"))).toBeUndefined();
    expect(imageSize(bytes([0xff, 0xd8, 0xff]))).toBeUndefined();
  });
});
