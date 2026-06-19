/** Client-safe shared constants (no Node-only imports). */

/** Maximum accepted upload size. */
export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_FILE_MB = MAX_FILE_BYTES / (1024 * 1024);

/** Extensions the scanner can extract text from. */
export const ALLOWED_EXTENSIONS = [
  ".pdf",
  ".txt",
  ".md",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
] as const;

/** Value for an <input type="file" accept="..."> attribute. */
export const FILE_ACCEPT_ATTR = ALLOWED_EXTENSIONS.join(",");

export function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "" : fileName.slice(dot).toLowerCase();
}

/** Returns a friendly error message if the file is invalid, else null. */
export function checkFileClientSide(file: File): string | null {
  if (file.size === 0) return "That file is empty.";
  if (file.size > MAX_FILE_BYTES) {
    return `File is too large. Maximum size is ${MAX_FILE_MB} MB.`;
  }
  const ext = extensionOf(file.name);
  if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) {
    return `Unsupported file type. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}.`;
  }
  return null;
}
