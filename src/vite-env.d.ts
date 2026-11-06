/// <reference types="vite/client" />

declare module "*.ttf?bytes" {
  /** base64 of the file's bytes (vite.fileBytes.ts). */
  const b64: string;
  export default b64;
}

declare module "*.ttf" {
  const src: string;
  export default src;
}
