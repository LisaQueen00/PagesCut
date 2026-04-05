import type { FinalComposition, FinalCompositionPage, HardEditPageDraft, Task } from "@/types/domain";

const A4_RATIO = 210 / 297;
const PDF_WIDTH_PT = 595.28;
const PDF_HEIGHT_PT = 841.89;
const RENDER_WIDTH_PX = 1240;
const RENDER_HEIGHT_PX = Math.round(RENDER_WIDTH_PX / A4_RATIO);

interface PdfExportInput {
  task: Task;
  composition: FinalComposition;
  compositionPages: FinalCompositionPage[];
  drafts: HardEditPageDraft[];
}

interface PdfExportResult {
  dataUrl: string;
  mimeType: string;
  byteSize: number;
}

interface PdfPageBitmap {
  bytes: Uint8Array;
  width: number;
  height: number;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatMultilineText(value: string) {
  return escapeHtml(value.trim() || " ").replace(/\n/g, "<br />");
}

function ensureImageLoaded(image: HTMLImageElement) {
  return new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Failed to rasterize page preview for PDF export."));
  });
}

function dataUrlToBytes(dataUrl: string) {
  const [, base64Payload = ""] = dataUrl.split(",", 2);
  const binary = window.atob(base64Payload);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function blobToDataUrl(blob: Blob) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read exported PDF blob."));
    reader.readAsDataURL(blob);
  });
}

function bytesFromAscii(value: string) {
  return new TextEncoder().encode(value);
}

function concatBytes(chunks: Uint8Array[]) {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;

  chunks.forEach((chunk) => {
    output.set(chunk, offset);
    offset += chunk.length;
  });

  return output;
}

function buildObject(objectId: number, body: Uint8Array | string) {
  const header = bytesFromAscii(`${objectId} 0 obj\n`);
  const footer = bytesFromAscii(`\nendobj\n`);
  const content = typeof body === "string" ? bytesFromAscii(body) : body;
  return concatBytes([header, content, footer]);
}

function buildStreamObject(objectId: number, dictionary: string, streamBytes: Uint8Array) {
  const header = bytesFromAscii(`${objectId} 0 obj\n<< ${dictionary} /Length ${streamBytes.length} >>\nstream\n`);
  const footer = bytesFromAscii(`\nendstream\nendobj\n`);
  return concatBytes([header, streamBytes, footer]);
}

function buildPdfDocument(pages: PdfPageBitmap[]) {
  const pageCount = pages.length;
  const catalogId = 1;
  const pagesRootId = 2;
  const pageObjectStartId = 3;
  const objects: Uint8Array[] = [];
  const offsets: number[] = [0];

  const pageIds = pages.map((_, index) => pageObjectStartId + index * 3);
  const contentIds = pages.map((_, index) => pageObjectStartId + index * 3 + 1);
  const imageIds = pages.map((_, index) => pageObjectStartId + index * 3 + 2);

  objects.push(buildObject(catalogId, `<< /Type /Catalog /Pages ${pagesRootId} 0 R >>`));
  objects.push(buildObject(pagesRootId, `<< /Type /Pages /Count ${pageCount} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >>`));

  pages.forEach((page, index) => {
    const pageId = pageIds[index];
    const contentId = contentIds[index];
    const imageId = imageIds[index];
    const imageName = `/Im${index + 1}`;
    const contentStream = bytesFromAscii(`q\n${PDF_WIDTH_PT} 0 0 ${PDF_HEIGHT_PT} 0 0 cm\n${imageName} Do\nQ`);

    objects.push(
      buildObject(
        pageId,
        `<< /Type /Page /Parent ${pagesRootId} 0 R /MediaBox [0 0 ${PDF_WIDTH_PT} ${PDF_HEIGHT_PT}] /Resources << /XObject << ${imageName} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`,
      ),
    );
    objects.push(buildStreamObject(contentId, ``, contentStream));
    objects.push(
      buildStreamObject(
        imageId,
        `/Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`,
        page.bytes,
      ),
    );
  });

  const header = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52, 10, 37, 226, 227, 207, 211, 10]);
  let currentOffset = header.length;
  offsets[0] = 0;

  objects.forEach((objectBytes) => {
    offsets.push(currentOffset);
    currentOffset += objectBytes.length;
  });

  const xrefOffset = currentOffset;
  const xrefEntries = offsets
    .map((offset, index) => `${String(offset).padStart(10, "0")} ${index === 0 ? "65535 f " : "00000 n "}`)
    .join("\n");
  const xref = bytesFromAscii(`xref\n0 ${offsets.length}\n${xrefEntries}\n`);
  const trailer = bytesFromAscii(`trailer\n<< /Size ${offsets.length} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  return concatBytes([header, ...objects, xref, trailer]);
}

function renderPageHtml(task: Task, page: FinalCompositionPage, draft: HardEditPageDraft, pageNumber: number, totalPages: number) {
  const header = `
    <div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;color:#6b7280;letter-spacing:0.12em;text-transform:uppercase;">
      <span>PagesCut</span>
      <span>${escapeHtml(page.pageType)}</span>
    </div>
    <div style="height:1px;background:#e5e7eb;margin-top:14px;"></div>
  `;

  const footer = `
    <div style="position:absolute;left:64px;right:64px;bottom:42px;display:flex;justify-content:space-between;align-items:center;font-size:13px;color:#6b7280;">
      <span>${escapeHtml(task.title)}</span>
      <span>${pageNumber} / ${totalPages}</span>
    </div>
  `;

  if (page.pageRole === "cover") {
    return `
      <div xmlns="http://www.w3.org/1999/xhtml" style="width:${RENDER_WIDTH_PX}px;height:${RENDER_HEIGHT_PX}px;background:#ffffff;position:relative;font-family:Inter, PingFang SC, Microsoft YaHei, sans-serif;box-sizing:border-box;padding:34px 64px 80px;">
        ${header}
        <div style="margin-top:28px;border-radius:36px;background:#18212d;color:#ffffff;padding:60px 54px 56px;min-height:390px;">
          <div style="font-size:56px;font-weight:700;line-height:1.18;">${formatMultilineText(draft.title || page.pageType)}</div>
          <div style="margin-top:28px;font-size:24px;line-height:1.7;color:rgba(255,255,255,0.82);">${formatMultilineText(draft.subtitle)}</div>
        </div>
        <div style="margin-top:28px;border-radius:32px;background:#f4f7fb;border:1px solid #e3e8f0;padding:34px 36px;">
          <div style="font-size:14px;color:#6b7280;letter-spacing:0.12em;text-transform:uppercase;">主视觉文案</div>
          <div style="margin-top:18px;font-size:29px;line-height:1.7;color:#1f2937;">${formatMultilineText(draft.bodyText || "当前封面页暂无主视觉文案。")}</div>
          <div style="margin-top:34px;font-size:18px;line-height:1.7;color:#64748b;">${formatMultilineText(draft.footerNote || "PagesCut")}</div>
        </div>
        ${footer}
      </div>
    `;
  }

  if (page.pageRole === "toc") {
    const tocEntries = (draft.bodyText.trim() || "1. 当前目录为空")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map(
        (line, index) => `
          <div style="display:grid;grid-template-columns:52px 1fr;gap:16px;align-items:start;padding:18px 0;border-bottom:1px solid #e5e7eb;">
            <div style="font-size:16px;font-weight:600;color:#111827;">${String(index + 1).padStart(2, "0")}</div>
            <div style="font-size:22px;line-height:1.5;color:#1f2937;">${escapeHtml(line)}</div>
          </div>
        `,
      )
      .join("");

    return `
      <div xmlns="http://www.w3.org/1999/xhtml" style="width:${RENDER_WIDTH_PX}px;height:${RENDER_HEIGHT_PX}px;background:#ffffff;position:relative;font-family:Inter, PingFang SC, Microsoft YaHei, sans-serif;box-sizing:border-box;padding:34px 64px 80px;">
        ${header}
        <div style="margin-top:34px;font-size:52px;font-weight:700;line-height:1.2;color:#111827;">${formatMultilineText(draft.title || page.pageType)}</div>
        <div style="margin-top:16px;font-size:22px;line-height:1.7;color:#6b7280;">${formatMultilineText(draft.subtitle)}</div>
        <div style="margin-top:38px;border-radius:32px;background:#fbfcfe;border:1px solid #e5e7eb;padding:20px 34px 14px;">${tocEntries}</div>
        <div style="margin-top:24px;font-size:18px;line-height:1.7;color:#64748b;">${formatMultilineText(draft.footerNote)}</div>
        ${footer}
      </div>
    `;
  }

  return `
    <div xmlns="http://www.w3.org/1999/xhtml" style="width:${RENDER_WIDTH_PX}px;height:${RENDER_HEIGHT_PX}px;background:#ffffff;position:relative;font-family:Inter, PingFang SC, Microsoft YaHei, sans-serif;box-sizing:border-box;padding:34px 64px 80px;">
      ${header}
      <div style="margin-top:28px;font-size:48px;font-weight:700;line-height:1.22;color:#111827;">${formatMultilineText(draft.title || page.pageType)}</div>
      <div style="margin-top:18px;font-size:21px;line-height:1.72;color:#6b7280;">${formatMultilineText(draft.subtitle)}</div>
      <div style="margin-top:34px;display:grid;grid-template-columns:1.45fr 0.95fr;gap:24px;">
        <div style="min-height:760px;border-radius:30px;background:#f8fafc;border:1px solid #e3e8f0;padding:34px 34px 30px;font-size:23px;line-height:1.82;color:#1f2937;">
          ${formatMultilineText(draft.bodyText || "当前页暂无正文。")}
        </div>
        <div style="display:flex;flex-direction:column;gap:18px;">
          <div style="border-radius:28px;background:#ffffff;border:1px solid #e3e8f0;padding:24px 24px 22px;">
            <div style="font-size:14px;color:#6b7280;letter-spacing:0.12em;text-transform:uppercase;">图片说明</div>
            <div style="margin-top:14px;font-size:20px;line-height:1.68;color:#1f2937;">${formatMultilineText(draft.imageCaption || "当前页无图片说明。")}</div>
          </div>
          <div style="border-radius:28px;background:#ffffff;border:1px solid #e3e8f0;padding:24px 24px 22px;">
            <div style="font-size:14px;color:#6b7280;letter-spacing:0.12em;text-transform:uppercase;">图表说明</div>
            <div style="margin-top:14px;font-size:20px;line-height:1.68;color:#1f2937;">${formatMultilineText(draft.chartCaption || "当前页无图表说明。")}</div>
          </div>
          <div style="border-radius:28px;background:#ffffff;border:1px solid #e3e8f0;padding:24px 24px 22px;">
            <div style="font-size:14px;color:#6b7280;letter-spacing:0.12em;text-transform:uppercase;">页尾备注</div>
            <div style="margin-top:14px;font-size:20px;line-height:1.68;color:#1f2937;">${formatMultilineText(draft.footerNote || "当前页无补充备注。")}</div>
          </div>
        </div>
      </div>
      ${footer}
    </div>
  `;
}

async function rasterizePage(pageHtml: string) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${RENDER_WIDTH_PX}" height="${RENDER_HEIGHT_PX}" viewBox="0 0 ${RENDER_WIDTH_PX} ${RENDER_HEIGHT_PX}">
      <foreignObject width="100%" height="100%">${pageHtml}</foreignObject>
    </svg>
  `;
  const image = new Image();
  image.decoding = "sync";
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await ensureImageLoaded(image);

  const canvas = document.createElement("canvas");
  canvas.width = RENDER_WIDTH_PX;
  canvas.height = RENDER_HEIGHT_PX;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas 2D context is unavailable for PDF export.");
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
  return {
    bytes: dataUrlToBytes(dataUrl),
    width: canvas.width,
    height: canvas.height,
  } satisfies PdfPageBitmap;
}

export async function generatePdfFromFinalComposition({ task, composition, compositionPages, drafts }: PdfExportInput): Promise<PdfExportResult> {
  const orderedPages = compositionPages
    .filter((page) => page.compositionId === composition.id)
    .slice()
    .sort((a, b) => a.orderIndex - b.orderIndex);
  const draftMap = new Map(drafts.map((draft) => [draft.compositionPageId, draft] as const));
  const rasterPages: PdfPageBitmap[] = [];

  for (let index = 0; index < orderedPages.length; index += 1) {
    const page = orderedPages[index];
    const draft = draftMap.get(page.id);
    if (!draft) {
      throw new Error(`Missing hard edit draft for composition page ${page.id}.`);
    }

    const pageHtml = renderPageHtml(task, page, draft, index + 1, orderedPages.length);
    const bitmap = await rasterizePage(pageHtml);
    rasterPages.push(bitmap);
  }

  const pdfBytes = buildPdfDocument(rasterPages);
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const dataUrl = await blobToDataUrl(blob);

  return {
    dataUrl,
    mimeType: "application/pdf",
    byteSize: pdfBytes.byteLength,
  };
}
