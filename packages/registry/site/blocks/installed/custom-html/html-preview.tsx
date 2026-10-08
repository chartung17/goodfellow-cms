"use client";

import { useEffect, useRef, useState } from "react";

/** Tells the editor how tall the HTML is, so the frame fits it. */
const REPORT_HEIGHT =
  "<script>new ResizeObserver(function(){parent.postMessage({goodfellowHtmlHeight:document.documentElement.scrollHeight},'*')}).observe(document.documentElement)</script>";

/**
 * Shows HTML as it was written, in the editor only: inside a frame sandboxed
 * without `allow-same-origin`, so its scripts run on their own and can't reach
 * the admin panel or the editor's sign-in. It has the page's styles.
 */
export function HtmlPreview({ html, className }: { html: string; className: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(120);
  const [styles, setStyles] = useState("");

  useEffect(() => {
    const document = frame.current?.ownerDocument;
    const view = document?.defaultView;
    if (!document || !view) return;
    setStyles(
      [...document.querySelectorAll('link[rel="stylesheet"], style')].map((element) => element.outerHTML).join(""),
    );
    const onMessage = (event: MessageEvent) => {
      const reported = (event.data as { goodfellowHtmlHeight?: unknown } | null)?.goodfellowHtmlHeight;
      if (event.source === frame.current?.contentWindow && typeof reported === "number") setHeight(Math.ceil(reported));
    };
    view.addEventListener("message", onMessage);
    return () => view.removeEventListener("message", onMessage);
  }, []);

  return (
    <iframe
      ref={frame}
      title="Custom HTML"
      sandbox="allow-scripts"
      srcDoc={`<!doctype html><html><head><meta charset="utf-8">${styles}</head><body style="margin:0">${html}${REPORT_HEIGHT}</body></html>`}
      className={className || undefined}
      style={{ display: "block", width: "100%", height, border: 0 }}
    />
  );
}
