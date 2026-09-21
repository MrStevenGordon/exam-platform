// pdfmake ships no types for its browser build; this covers only what the
// lesson plan export uses.
declare module 'pdfmake/build/pdfmake' {
  type PdfOutput = { download(filename?: string): Promise<void>; getBlob(): Promise<Blob>; getBuffer(): Promise<Uint8Array> }
  const pdfMake: { addVirtualFileSystem(vfs: Record<string, string>): void; createPdf(definition: unknown): PdfOutput }
  export default pdfMake
}
declare module 'pdfmake/build/vfs_fonts' {
  const vfs: Record<string, string>
  export default vfs
}
