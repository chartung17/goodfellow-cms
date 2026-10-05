// Web APIs that exist in both Node and browsers. Declared here because core
// doesn't include the DOM type library.
declare class TextEncoder {
  encode(input?: string): Uint8Array;
}
declare function btoa(data: string): string;
