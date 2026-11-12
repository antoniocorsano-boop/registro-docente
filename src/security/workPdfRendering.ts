/**
 * Compose the existing privacy-aware report as selectable PDF text, not a
 * screenshot of the hidden Tailwind template. html2pdf 0.10.1 already bundles
 * jsPDF; initialize its documented canvas worker using an empty 1px canvas,
 * discard the bootstrap page, and use the resulting local PDF document.
 * This avoids html2canvas's unsupported modern CSS colors and hidden layout.
 */
const WIDTHS = [8, 42, 20, 20, 25, 22, 25, 28];
const LEFT = 10;
const RIGHT = 200;
const BOTTOM = 278;
const LINE = 3.7;

function textOf(node: Element | null | undefined): string {
  return (node?.textContent || '').trim().replace(/\s+/g, ' ')
    .replace(/≥/g, '>=').replace(/≤/g, '<=');
}

export async function renderWorkPdf(element: HTMLElement): Promise<ArrayBuffer> {
  if (typeof html2pdf === 'undefined') throw new Error('Generatore PDF locale non disponibile.');
  // Read only the already rendered report (including its current privacy mask).
  const table = element.querySelector('table');
  const columns = Array.from(table?.querySelectorAll('thead th') || [], textOf);
  const rows = Array.from(table?.querySelectorAll('tbody tr') || [], row =>
    Array.from(row.querySelectorAll('td'), textOf));
  const header = element.firstElementChild;
  const heading = textOf(header?.querySelector('h1'));
  const title = textOf(header?.querySelector('h2'));
  const context = textOf(header?.querySelector('p'));
  const metadata = Array.from(header?.children[1]?.children || [], textOf).filter(Boolean);
  const footnote = textOf(element.lastElementChild);
  if (!heading || !title || !context || columns.length !== WIDTHS.length ||
      rows.some(row => row.length !== WIDTHS.length) || !footnote) {
    throw new Error('Prospetto non completo.');
  }

  const seed = document.createElement('canvas');
  seed.width = 1;
  seed.height = 1;
  const seedContext = seed.getContext('2d');
  if (!seedContext) throw new Error('Generatore PDF non disponibile.');
  seedContext.fillStyle = '#ffffff';
  seedContext.fillRect(0, 0, 1, 1);
  const worker = (html2pdf() as any).set({
    margin: 10, enableLinks: false, image: { type: 'png' },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait', compress: false },
  }).from(seed, 'canvas').toPdf();
  const pdf = await worker.get('pdf');
  // Never return the bootstrap raster; every retained page is the real report.
  pdf.addPage();
  pdf.deletePage(1);
  pdf.setPage(1);
  let y = 10;
  let emittedRows = 0;

  function paragraph(value: string, size: number, bold = false) {
    if (!value) return;
    pdf.setFont('helvetica', bold ? 'bold' : 'normal');
    pdf.setFontSize(size);
    pdf.setTextColor(15, 23, 42);
    const lines: string[] = pdf.splitTextToSize(value, RIGHT - LEFT);
    const height = lines.length * (size * 0.36 * 1.2) + 2;
    if (y + height > BOTTOM) throw new Error('Intestazione del prospetto troppo lunga.');
    pdf.text(lines, LEFT, y + size * 0.36, { lineHeightFactor: 1.2 });
    y += height;
  }
  function pageHeader(first: boolean) {
    y = 10;
    if (first) paragraph(heading, 12, true);
    paragraph(title, 11, true);
    paragraph(context, 9);
    if (first) for (const line of metadata) paragraph(line, 8);
    y += 2;
  }
  function measure(cells: string[], headingRow: boolean) {
    pdf.setFont('helvetica', headingRow ? 'bold' : 'normal');
    pdf.setFontSize(8);
    const lines = cells.map((cell, i) => pdf.splitTextToSize(cell || '–', WIDTHS[i] - 3) as string[]);
    return { lines, height: Math.max(7, ...lines.map(line => line.length * LINE + 3)) };
  }
  function drawRow(cells: string[], headingRow: boolean, shade = false) {
    const { lines, height } = measure(cells, headingRow);
    if (y + height > BOTTOM) throw new Error('Riga del prospetto troppo lunga.');
    let x = LEFT;
    pdf.setDrawColor(203, 213, 225);
    pdf.setLineWidth(0.2);
    pdf.setTextColor(15, 23, 42);
    for (let i = 0; i < WIDTHS.length; i++) {
      pdf.setFillColor(...(headingRow ? [226, 232, 240] : shade ? [248, 250, 252] : [255, 255, 255]));
      pdf.rect(x, y, WIDTHS[i], height, 'FD');
      pdf.text(lines[i], x + 1.5, y + 4, { lineHeightFactor: 1.15 });
      x += WIDTHS[i];
    }
    y += height;
  }

  pageHeader(true);
  drawRow(columns, true);
  rows.forEach((row, index) => {
    if (y + measure(row, false).height > BOTTOM) {
      pdf.addPage();
      pageHeader(false);
      drawRow(columns, true);
    }
    drawRow(row, false, index % 2 === 1);
    emittedRows++;
  });
  if (y + 18 > BOTTOM) {
    pdf.addPage();
    pageHeader(false);
  }
  y += 4;
  paragraph(footnote, 8);
  const pages = pdf.internal.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(71, 85, 105);
    pdf.text(`Pagina ${page} di ${pages}`, RIGHT, 288, { align: 'right' });
  }
  if (emittedRows !== rows.length || pages < 1) throw new Error('Prospetto incompleto.');
  const buffer: ArrayBuffer = pdf.output('arraybuffer');
  if (buffer.byteLength < 1000 || new TextDecoder().decode(buffer.slice(0, 5)) !== '%PDF-') {
    throw new Error('Prospetto PDF non valido.');
  }
  return buffer;
}
