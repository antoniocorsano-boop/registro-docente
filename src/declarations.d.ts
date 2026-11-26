declare module 'mammoth' {
  interface ExtractResult {
    value: string;
    messages: any[];
  }
  export function extractRawText(options: { arrayBuffer: ArrayBuffer }): Promise<ExtractResult>;
}

