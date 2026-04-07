import type { EditedCompositionPageResult, FinalComposition, FinalCompositionPage } from "@/types/domain";

const A4_RATIO = 210 / 297;
const PDF_WIDTH_PT = 595.28;
const PDF_HEIGHT_PT = 841.89;
const RENDER_WIDTH_PX = 1240;
const RENDER_HEIGHT_PX = Math.round(RENDER_WIDTH_PX / A4_RATIO);

interface PdfExportInput {
  composition: FinalComposition;
  compositionPages: FinalCompositionPage[];
  pageResults: EditedCompositionPageResult[];
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

export async function generatePdfFromFinalComposition({ composition, compositionPages, pageResults }: PdfExportInput): Promise<PdfExportResult> {
  const orderedPages = compositionPages
    .filter((page) => page.compositionId === composition.id)
    .slice()
    .sort((a, b) => a.orderIndex - b.orderIndex);
  const resultMap = new Map(pageResults.map((result) => [result.compositionPageId, result] as const));
  const rasterPages: PdfPageBitmap[] = [];

  for (let index = 0; index < orderedPages.length; index += 1) {
    const page = orderedPages[index];
    const pageResult = resultMap.get(page.id);
    if (!pageResult) {
      throw new Error(`Missing page result for composition page ${page.id}.`);
    }

    const bitmap = await rasterizePage(pageResult.previewHtml);
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
