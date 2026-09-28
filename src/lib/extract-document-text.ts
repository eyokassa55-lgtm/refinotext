function fileKind(file: File): "pdf" | "docx" | "doc" | "text" {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  if (name.endsWith(".pdf") || type === "application/pdf") return "pdf";
  if (name.endsWith(".docx") || type.includes("wordprocessingml")) return "docx";
  if (name.endsWith(".doc") || type === "application/msword") return "doc";
  return "text";
}

async function extractPdf(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pages.push(
      content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim(),
    );
  }
  return pages.filter(Boolean).join("\n\n").trim();
}

async function extractDocx(file: File): Promise<string> {
  const mammothMod = await import("mammoth");
  const mammoth = mammothMod.default ?? mammothMod;
  const { value } = await mammoth.extractRawText({
    arrayBuffer: await file.arrayBuffer(),
  });
  return value.replace(/\n{3,}/g, "\n\n").trim();
}

export async function extractDocumentText(file: File): Promise<string> {
  const kind = fileKind(file);
  if (kind === "doc") {
    throw new Error("Old .doc files are not supported. Save as DOCX, PDF, or TXT.");
  }

  try {
    const text =
      kind === "pdf"
        ? await extractPdf(file)
        : kind === "docx"
          ? await extractDocx(file)
          : (await file.text()).trim();

    if (!text) {
      throw new Error("No readable text found in that file.");
    }
    return text;
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.startsWith("No readable") || error.message.startsWith("Old .doc"))
    ) {
      throw error;
    }
    throw new Error(
      kind === "pdf"
        ? "Could not read that PDF. Try a DOCX or TXT file."
        : kind === "docx"
          ? "Could not read that DOCX. Try a TXT file."
          : "Could not read that file.",
    );
  }
}
