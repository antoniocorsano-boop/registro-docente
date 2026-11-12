import regularFontUrl from 'dejavu-fonts-ttf/ttf/DejaVuSans.ttf?url';
import boldFontUrl from 'dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf?url';

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
// Standard PDF Helvetica supports WinAnsi, not arbitrary Unicode.
const WIN_ANSI = /^[\x20-\x7e\xa0-\xff€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]*$/u;

async function fontBase64(url: string): Promise<string> {
  const local = new URL(url, window.location.href);
  if (local.origin !== window.location.origin) throw new Error('Carattere PDF locale non disponibile.');
  const response = await fetch(local.href);
  if (!response.ok) throw new Error('Carattere PDF locale non disponibile.');
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 16384) binary += String.fromCharCode(...bytes.subarray(i, i + 16384));
  return btoa(binary);
}

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
  const allText = [heading, title, context, ...metadata, ...columns, ...rows.flat(), footnote];
  const unicode = allText.some(value => !WIN_ANSI.test(value));
  const family = unicode ? 'RegistroUnicode' : 'helvetica';
  if (unicode) {
    const [regular, bold] = await Promise.all([fontBase64(regularFontUrl), fontBase64(boldFontUrl)]);
    pdf.addFileToVFS('RegistroUnicode-Regular.ttf', regular);
    pdf.addFileToVFS('RegistroUnicode-Bold.ttf', bold);
    pdf.addFont('RegistroUnicode-Regular.ttf', family, 'normal');
    pdf.addFont('RegistroUnicode-Bold.ttf', family, 'bold');
    // The bundled jsPDF encoder is BMP-based; fail closed rather than silently
    // emitting a missing glyph, truncating a name or corrupting a surrogate.
    for (const style of ['normal', 'bold']) {
      pdf.setFont(family, style);
      const font = pdf.getFont().metadata;
      if (typeof font?.characterToGlyph !== 'function') throw new Error('Carattere PDF non verificabile.');
      for (const value of allText) for (const char of value) {
        const code = char.codePointAt(0)!;
        if (code > 0xffff || !font.characterToGlyph(code)) {
          throw new Error('Il prospetto contiene caratteri non supportati dal PDF locale.');
        }
      }
    }
  }
  // Never return the bootstrap raster; every retained page is the real report.
  pdf.addPage();
  pdf.deletePage(1);
  pdf.setPage(1);
  let y = 10;
  let emittedRows = 0;

  function paragraph(value: string, size: number, bold = false) {
    if (!value) return;
    pdf.setFont(family, bold ? 'bold' : 'normal');
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
    pdf.setFont(family, headingRow ? 'bold' : 'normal');
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
    pdf.setFont(family, 'normal');
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
