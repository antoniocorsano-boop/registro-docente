/**
 * Render only the existing report template, never the surrounding application.
 * The detached copy is necessary because the print template is display:none on screen.
 * Explicit sRGB colors keep the legacy html2canvas renderer compatible with Tailwind 4.
 */
export function cloneWorkPdfTemplate(element: HTMLElement): HTMLElement {
  const clone = element.cloneNode(true) as HTMLElement;
  clone.removeAttribute('id');
  clone.classList.remove('hidden', 'print:block');
  clone.style.display = 'block';
  clone.style.backgroundColor = '#ffffff';
  clone.style.color = '#111827';
  clone.style.colorScheme = 'light';
  const colors: Record<string, string> = {
    'text-black': '#000000', 'text-slate-900': '#0f172a', 'text-slate-800': '#1e293b',
    'text-slate-700': '#334155', 'text-slate-600': '#475569', 'text-slate-500': '#64748b',
  };
  for (const node of [clone, ...Array.from(clone.querySelectorAll<HTMLElement>('*'))]) {
    node.style.color = Object.entries(colors).find(([name]) => node.classList.contains(name))?.[1] || '#111827';
    node.style.borderColor = node.classList.contains('border-slate-900') ? '#0f172a' : '#cbd5e1';
    node.style.backgroundColor = node === clone || node.classList.contains('bg-white') ? '#ffffff'
      : node.classList.contains('bg-slate-100') ? '#f1f5f9'
      : node.classList.contains('even:bg-slate-50') && (Array.from(node.parentElement?.children || []).indexOf(node) + 1) % 2 === 0 ? '#f8fafc'
      : 'transparent';
  }
  return clone;
}

export async function renderWorkPdf(element: HTMLElement): Promise<ArrayBuffer> {
  if (typeof html2pdf === 'undefined') throw new Error('Generatore PDF locale non disponibile.');
  const clone = cloneWorkPdfTemplate(element);
  const worker = (html2pdf() as any).set({
    margin: 10, image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, backgroundColor: '#ffffff' },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
  }).from(clone).toCanvas();
  // Fail on an empty raster instead of recording a blank file as a useful report.
  const canvas: HTMLCanvasElement = await worker.get('canvas');
  if (!canvas.width || !canvas.height) throw new Error('Prospetto vuoto.');
  const sample = document.createElement('canvas');
  sample.width = 96; sample.height = 96;
  const context = sample.getContext('2d');
  if (!context) throw new Error('Prospetto non verificabile.');
  context.drawImage(canvas, 0, 0, 96, 96);
  const pixels = context.getImageData(0, 0, 96, 96).data;
  let ink = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] > 0 && Math.min(pixels[i], pixels[i + 1], pixels[i + 2]) < 210) ink++;
  }
  if (ink < 10) throw new Error('Prospetto senza contenuto visibile.');
  return worker.toPdf().outputPdf('arraybuffer');
}
