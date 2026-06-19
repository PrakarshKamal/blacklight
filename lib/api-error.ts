import type { ScanErrorCode } from "./types";

/** HTTP status for each stable error code. */
export const HTTP_STATUS: Record<ScanErrorCode, number> = {
  INVALID_INPUT: 400,
  UNSUPPORTED_TYPE: 415,
  FILE_TOO_LARGE: 413,
  NO_TEXT: 422,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

/**
 * An error with a stable, client-safe code and message. Anything thrown that
 * is NOT an ApiError is treated as an internal error and its details are never
 * sent to the client.
 */
export class ApiError extends Error {
  readonly code: ScanErrorCode;
  readonly status: number;

  constructor(code: ScanErrorCode, message: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = HTTP_STATUS[code];
  }
}
