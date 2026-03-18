function sanitizePdfText(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7E]/g, " ");
}

function wrapParagraph(paragraph, maxChars) {
  const words = paragraph.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [""];
  }

  const lines = [];
  let currentLine = words[0];

  for (const word of words.slice(1)) {
    if (`${currentLine} ${word}`.length <= maxChars) {
      currentLine = `${currentLine} ${word}`;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }

  lines.push(currentLine);
  return lines;
}

function buildPdfLines(text, maxChars = 88) {
  const rawLines = String(text ?? "").replace(/\r/g, "").split("\n");
  const pdfLines = [];

  for (const rawLine of rawLines) {
    const wrapped = wrapParagraph(rawLine, maxChars);
    pdfLines.push(...wrapped);
  }

  return pdfLines;
}

function buildPdfContentStream(title, text) {
  const lines = buildPdfLines(text);
  const pageHeight = 792;
  const left = 50;
  const top = 742;
  const lineHeight = 16;
  const linesPerPage = 42;
  const pages = [];

  for (let index = 0; index < lines.length; index += linesPerPage) {
    pages.push(lines.slice(index, index + linesPerPage));
  }

  if (pages.length === 0) {
    pages.push([""]);
  }

  const contentStreams = pages.map((pageLines, pageIndex) => {
    const headerLines = pageIndex === 0 ? [title, ""] : [`${title} (cont.)`, ""];
    const allLines = [...headerLines, ...pageLines];
    const content = [
      "BT",
      "/F1 12 Tf",
      `${left} ${top} Td`,
      `${lineHeight} TL`,
      ...allLines.map((line, lineIndex) =>
        lineIndex === 0
          ? `(${sanitizePdfText(line)}) Tj`
          : `T* (${sanitizePdfText(line)}) Tj`
      ),
      "ET"
    ].join("\n");

    return {
      content,
      pageHeight
    };
  });

  return contentStreams;
}

export function downloadPdfDocument(filename, title, text) {
  const contentStreams = buildPdfContentStream(title, text);
  let objectIndex = 1;
  const objects = [];

  const catalogId = objectIndex++;
  const pagesId = objectIndex++;
  const pageObjects = contentStreams.map(() => objectIndex++);
  const contentObjects = contentStreams.map(() => objectIndex++);
  const fontId = objectIndex++;

  objects.push({ id: catalogId, content: `<< /Type /Catalog /Pages ${pagesId} 0 R >>` });
  objects.push({
    id: pagesId,
    content: `<< /Type /Pages /Kids [${pageObjects.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageObjects.length} >>`
  });

  contentStreams.forEach((stream, index) => {
    objects.push({
      id: pageObjects[index],
      content:
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 ${stream.pageHeight}] ` +
        `/Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentObjects[index]} 0 R >>`
    });
  });

  contentStreams.forEach((stream, index) => {
    objects.push({
      id: contentObjects[index],
      content: `<< /Length ${stream.content.length} >>\nstream\n${stream.content}\nendstream`
    });
  });

  objects.push({ id: fontId, content: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>" });

  let pdf = "%PDF-1.4\n";
  const offsets = [];

  for (const object of objects) {
    offsets[object.id] = pdf.length;
    pdf += `${object.id} 0 obj\n${object.content}\nendobj\n`;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";

  for (let id = 1; id <= objects.length; id += 1) {
    pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  const blob = new Blob([pdf], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
