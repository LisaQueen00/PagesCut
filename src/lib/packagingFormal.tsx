import { useEffect, useRef, useState, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { FinalCompositionPage, PackagingPageFormal } from "@/types/domain";

export const PACKAGING_PAGE_BASE_WIDTH = 920;
export const PACKAGING_PAGE_BASE_HEIGHT = 1301;

function PackagingPageShell({ children }: { children: ReactNode }) {
  return (
    <article
      style={{
        width: PACKAGING_PAGE_BASE_WIDTH,
        height: PACKAGING_PAGE_BASE_HEIGHT,
        background: "#ffffff",
        boxSizing: "border-box",
        padding: 28,
        fontFamily: "Inter, PingFang SC, Microsoft YaHei, sans-serif",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          border: "1px solid #dbe5ef",
          borderRadius: 28,
          background: "#ffffff",
          boxShadow: "0 18px 34px rgba(15,23,42,0.06)",
          padding: 28,
          boxSizing: "border-box",
          overflow: "hidden",
        }}
      >
        {children}
      </div>
    </article>
  );
}

export function PackagingPageRenderer({
  pageRole,
  formal,
}: {
  pageRole: FinalCompositionPage["pageRole"];
  formal: PackagingPageFormal;
}) {
  if (pageRole === "cover") {
    return (
      <PackagingPageShell>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.16fr) minmax(0, 0.84fr)",
            gap: 24,
            height: "100%",
            minHeight: 0,
          }}
        >
          <section
            style={{
              borderRadius: 28,
              background: "#18212d",
              color: "#ffffff",
              padding: 34,
              boxSizing: "border-box",
              minWidth: 0,
              minHeight: 0,
              overflow: "hidden",
              display: "grid",
              gridTemplateRows: "auto auto minmax(0, 1fr) auto",
            }}
          >
            <div
              style={{
                fontSize: 11,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.72)",
                overflowWrap: "anywhere",
              }}
            >
              {formal.issueLabel || formal.kicker || "Cover"}
            </div>
            <h1
              style={{
                margin: "18px 0 0",
                fontSize: 54,
                lineHeight: 1.12,
                fontWeight: 700,
                overflowWrap: "anywhere",
              }}
            >
              {formal.title}
            </h1>
            <p
              style={{
                margin: "22px 0 0",
                fontSize: 24,
                lineHeight: 1.7,
                color: "rgba(255,255,255,0.82)",
                overflowWrap: "anywhere",
              }}
            >
              {formal.subtitle}
            </p>
            <div
              style={{
                alignSelf: "end",
                borderTop: "1px solid rgba(255,255,255,0.16)",
                paddingTop: 20,
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.58)",
                  overflowWrap: "anywhere",
                }}
              >
                {formal.brandLabel || "PagesCut Research"}
              </div>
              <p
                style={{
                  margin: "14px 0 0",
                  fontSize: 16,
                  lineHeight: 1.8,
                  color: "rgba(255,255,255,0.78)",
                  overflowWrap: "anywhere",
                }}
              >
                {formal.footerNote}
              </p>
            </div>
          </section>
          <section
            style={{
              borderRadius: 28,
              border: "1px solid #e5e7eb",
              background: "#f8fafc",
              padding: 34,
              boxSizing: "border-box",
              minWidth: 0,
              minHeight: 0,
              overflow: "hidden",
              display: "grid",
              gridTemplateRows: "auto minmax(0, 1fr) auto",
              gap: 18,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "#64748b",
                  overflowWrap: "anywhere",
                }}
              >
                Cover Direction
              </div>
              <h2
                style={{
                  margin: "16px 0 0",
                  fontSize: 24,
                  lineHeight: 1.35,
                  fontWeight: 500,
                  color: "#475569",
                  overflowWrap: "anywhere",
                }}
              >
                {formal.kicker || "Monthly Brief"}
              </h2>
            </div>
            <div
              style={{
                borderRadius: 24,
                background: "linear-gradient(145deg, rgba(209,231,225,0.8) 0%, rgba(255,255,255,0.92) 100%)",
                boxShadow: "inset 0 0 0 1px rgba(209,231,225,0.9)",
                minHeight: 0,
                overflow: "hidden",
                padding: 20,
                display: "grid",
                alignItems: "end",
              }}
            >
              <div
                style={{
                  borderRadius: 18,
                  background: "rgba(255,255,255,0.72)",
                  border: "1px solid rgba(226,232,240,0.9)",
                  minHeight: 120,
                  padding: 18,
                  display: "flex",
                  alignItems: "flex-end",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: 15,
                    lineHeight: 1.75,
                    color: "#0f172a",
                    overflowWrap: "anywhere",
                  }}
                >
                  {formal.heroLabel || ""}
                </p>
              </div>
            </div>
            <div style={{ alignSelf: "end" }}>
              <div
                style={{
                  fontSize: 12,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "#64748b",
                  overflowWrap: "anywhere",
                }}
              >
                封面导向主视觉
              </div>
              <p
                style={{
                  margin: "12px 0 0",
                  fontSize: 16,
                  lineHeight: 1.8,
                  color: "#64748b",
                  overflowWrap: "anywhere",
                }}
              >
                {formal.summary}
              </p>
            </div>
          </section>
        </div>
      </PackagingPageShell>
    );
  }

  return (
    <PackagingPageShell>
      <div
        style={{
          width: "100%",
          height: "100%",
          padding: 6,
          boxSizing: "border-box",
          overflow: "hidden",
          display: "grid",
          gridTemplateRows: "auto auto auto minmax(0,1fr) auto auto",
          minHeight: 0,
        }}
      >
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "#64748b",
            overflowWrap: "anywhere",
          }}
        >
          Table Of Contents
        </div>
        <h1
          style={{
            margin: "18px 0 0",
            fontSize: 46,
            lineHeight: 1.16,
            fontWeight: 700,
            color: "#111827",
            overflowWrap: "anywhere",
          }}
        >
          {formal.title}
        </h1>
        <p
          style={{
            margin: "14px 0 0",
            fontSize: 18,
            lineHeight: 1.7,
            color: "#64748b",
            overflowWrap: "anywhere",
          }}
        >
          {formal.subtitle}
        </p>
        <section
          style={{
            marginTop: 30,
            borderRadius: 28,
            border: "1px solid #e5e7eb",
            background: "#fbfcfe",
            padding: "18px 30px 14px",
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          {(formal.tocEntries ?? []).map((line, index) => (
            <div
              key={`${formal.id}-toc-${index}`}
              style={{
                display: "grid",
                gridTemplateColumns: "52px 1fr",
                gap: 16,
                alignItems: "start",
                padding: "14px 0",
                borderBottom: "1px solid #e5e7eb",
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 600, color: "#111827" }}>{String(index + 1).padStart(2, "0")}</div>
              <div style={{ fontSize: 20, lineHeight: 1.55, color: "#1f2937", overflowWrap: "anywhere" }}>{line}</div>
            </div>
          ))}
        </section>
        <p
          style={{
            margin: "20px 0 0",
            fontSize: 16,
            lineHeight: 1.8,
            color: "#64748b",
            overflowWrap: "anywhere",
          }}
        >
          {formal.guidanceNote ?? ""}
        </p>
        <p
          style={{
            margin: "18px 0 0",
            fontSize: 16,
            lineHeight: 1.8,
            color: "#64748b",
            overflowWrap: "anywhere",
          }}
        >
          {formal.footerNote}
        </p>
      </div>
    </PackagingPageShell>
  );
}

export function PackagingPagePreview({
  pageRole,
  formal,
  maxWidth,
}: {
  pageRole: FinalCompositionPage["pageRole"];
  formal: PackagingPageFormal;
  maxWidth: number;
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
  const scale = safeWidth / PACKAGING_PAGE_BASE_WIDTH;
  const previewHeight = Math.round(PACKAGING_PAGE_BASE_HEIGHT * scale);

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
      <div
        style={{
          width: PACKAGING_PAGE_BASE_WIDTH,
          height: PACKAGING_PAGE_BASE_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        <PackagingPageRenderer pageRole={pageRole} formal={formal} />
      </div>
    </div>
  );
}

export function renderPackagingFormalToHtml(pageRole: FinalCompositionPage["pageRole"], formal: PackagingPageFormal) {
  return renderToStaticMarkup(<PackagingPageRenderer pageRole={pageRole} formal={formal} />);
}
