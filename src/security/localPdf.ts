/** Use only the locally pinned jsPDF UMD build. No HTML rendering or image
 * plugin is needed by the text-based professional document generators. */
export function createLocalPdf(): any {
  const runtime = globalThis as unknown as {
    jspdf?: { jsPDF?: new (options: { unit: string; format: string; orientation: string; compress: boolean }) => any }
  };
  const Constructor = runtime.jspdf?.jsPDF;
  if (typeof Constructor !== 'function') throw new Error('Generatore PDF locale non disponibile.');
  return new Constructor({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: false });
}
