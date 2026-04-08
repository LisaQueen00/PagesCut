import { useEffect, useRef, useState } from "react";

export const HTML_PREVIEW_BASE_WIDTH = 920;
export const HTML_PREVIEW_BASE_HEIGHT = 1301;

export function HtmlPreviewFrame({
  html,
  frameWidth,
  frameHeight,
  baseWidth = HTML_PREVIEW_BASE_WIDTH,
  baseHeight = HTML_PREVIEW_BASE_HEIGHT,
  className,
  overlayClassName,
}: {
  html: string;
  frameWidth: number;
  frameHeight: number;
  baseWidth?: number;
  baseHeight?: number;
  className?: string;
  overlayClassName?: string;
}) {
  const scale = frameWidth / baseWidth;

  return (
    <div
      className={className}
      style={{
        width: frameWidth,
        maxWidth: "100%",
        height: frameHeight,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        style={{
          width: baseWidth,
          height: baseHeight,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {overlayClassName ? <div className={overlayClassName} /> : null}
    </div>
  );
}

export function ResponsiveHtmlPreview({
  html,
  maxWidth,
  baseWidth = HTML_PREVIEW_BASE_WIDTH,
  baseHeight = HTML_PREVIEW_BASE_HEIGHT,
}: {
  html: string;
  maxWidth: number;
  baseWidth?: number;
  baseHeight?: number;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [previewWidth, setPreviewWidth] = useState(maxWidth);

  useEffect(() => {
    const element = hostRef.current;
    if (!element) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      const nextWidth = Math.min(maxWidth, entry.contentRect.width);
      setPreviewWidth(nextWidth > 0 ? nextWidth : maxWidth);
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [maxWidth]);

  const safeWidth = Math.max(1, previewWidth);
  const previewHeight = Math.round(baseHeight * (safeWidth / baseWidth));

  return (
    <div
      ref={hostRef}
      style={{
        width: "100%",
        maxWidth,
        height: previewHeight,
        position: "relative",
      }}
    >
      <HtmlPreviewFrame html={html} frameWidth={safeWidth} frameHeight={previewHeight} baseWidth={baseWidth} baseHeight={baseHeight} />
    </div>
  );
}
