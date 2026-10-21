declare module 'mammoth' {
  interface ExtractResult {
    value: string;
    messages: any[];
  }
  export function extractRawText(options: { arrayBuffer: ArrayBuffer }): Promise<ExtractResult>;
}

declare function html2pdf(): {
  from(element: HTMLElement | null): {
    save(filename?: string): Promise<void>;
  };
};
