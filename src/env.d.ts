// Runtime globals available in Node.js 16+ and all modern browsers
declare class TextEncoder {
  encode(input?: string): Uint8Array;
}

declare function btoa(data: string): string;
declare function atob(data: string): string;

// Node.js globals for CLI
declare var process: {
  argv: string[];
  stdout: { write(s: string): boolean };
  stderr: { write(s: string): boolean };
  exit(code?: number): never;
};


declare module "node:fs" {
  export function writeFileSync(path: string, data: string, encoding?: string): void;
}
