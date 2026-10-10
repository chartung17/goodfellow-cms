import { entryTitle, MEDIA_DIR, type SiteContent } from "@goodfellow-cms/core";
import { pageTitle, slugify, uniqueName } from "./changes.js";

/** Files in `public/media/` are served from `/media/` on the site. */
export const MEDIA_URL_PREFIX = "/media/";

/** `public/media/photo.jpg` → `/media/photo.jpg`. */
export function mediaUrl(path: string): string {
  return `${MEDIA_URL_PREFIX}${path.slice(MEDIA_DIR.length + 1)}`;
}

/** `/media/photo.jpg` → `public/media/photo.jpg`, or `undefined` for addresses outside the media folder. */
export function mediaPath(url: string): string | undefined {
  if (!url.startsWith(MEDIA_URL_PREFIX)) return undefined;
  const rest = url.slice(MEDIA_URL_PREFIX.length).split(/[?#]/)[0] ?? "";
  if (!rest || rest.split("/").some((part) => part === "" || part === "." || part === "..")) return undefined;
  return `${MEDIA_DIR}/${decodeURIComponent(rest)}`;
}

export type MediaKind = "image" | "document" | "audio" | "video";

/** The kinds of file that can be uploaded, by extension. Pages, scripts and other files that could run code aren't allowed. */
const KINDS: Record<string, MediaKind> = {
  jpg: "image",
  jpeg: "image",
  png: "image",
  gif: "image",
  webp: "image",
  avif: "image",
  svg: "image",
  ico: "image",
  pdf: "document",
  txt: "document",
  csv: "document",
  doc: "document",
  docx: "document",
  xls: "document",
  xlsx: "document",
  ppt: "document",
  pptx: "document",
  odt: "document",
  ods: "document",
  odp: "document",
  mp3: "audio",
  m4a: "audio",
  mp4: "video",
  webm: "video",
  // Captions and subtitles for videos.
  vtt: "document",
};

export const ALLOWED_EXTENSIONS = Object.keys(KINDS);

/** The largest file that can be uploaded, after large photos are made smaller. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

/** What kind of file a name or address is, or `undefined` if it can't be uploaded. */
export function mediaKind(name: string): MediaKind | undefined {
  return KINDS[extensionOf(name)];
}

/** The file's name, without its folder: `public/media/photo.jpg` → `photo.jpg`. */
export function fileName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

/**
 * The name an upload is saved under: lowercase, with hyphens, and not one
 * that's already taken. `Easter Vigil (1).JPEG` → `easter-vigil-1.jpg`.
 */
export function uploadName(original: string, taken: Iterable<string>): string {
  const extension = extensionOf(original).replace(/^jpeg$/, "jpg");
  const base = slugify(original.slice(0, original.length - extensionOf(original).length - 1) || original) || "file";
  const names = new Set([...taken].map((name) => name.toLowerCase()));
  const stems = new Set(
    [...names].filter((name) => name.endsWith(`.${extension}`)).map((name) => name.slice(0, -extension.length - 1)),
  );
  return `${uniqueName(base, stems)}.${extension}`;
}

/** A file size in words: `2.4 MB`. */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Where a media file is used, by name, so editors know what deleting or replacing it affects. */
export function mediaUsage(
  content: SiteContent,
  url: string,
  names: { header: string; footer: string; settings: string; css: string },
): string[] {
  const uses = (value: unknown) => JSON.stringify(value).includes(url);
  const used: string[] = [];
  if (uses(content.settings)) used.push(names.settings);
  if (uses(content.header)) used.push(names.header);
  if (uses(content.footer)) used.push(names.footer);
  for (const page of content.pages) if (uses(page.content)) used.push(pageTitle(page));
  for (const collection of content.collections) {
    if (uses(collection.settings)) used.push(collection.settings.name);
    for (const entry of collection.entries) if (uses(entry.content)) used.push(entryTitle(entry));
  }
  if (content.customCss.includes(url)) used.push(names.css);
  return used;
}

/** The addresses of the site's uploaded images, such as `/media/photo.jpg`. */
export function siteImages(media: string[]): string[] {
  return media.filter((path) => mediaKind(path) === "image").map(mediaUrl);
}
