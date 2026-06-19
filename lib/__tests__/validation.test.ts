import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api-error";
import {
  assertValidUpload,
  MAX_FILE_BYTES,
  validateScanRequest,
} from "@/lib/validation";

const PDF_BYTES = Buffer.from("%PDF-1.4\n...rest of file");
const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe("assertValidUpload", () => {
  it("accepts a valid PDF", () => {
    expect(() =>
      assertValidUpload("doc.pdf", PDF_BYTES.length, PDF_BYTES)
    ).not.toThrow();
  });

  it("accepts a valid PNG", () => {
    expect(() =>
      assertValidUpload("shot.png", PNG_BYTES.length, PNG_BYTES)
    ).not.toThrow();
  });

  it("rejects an empty file", () => {
    expect(() => assertValidUpload("doc.pdf", 0, Buffer.alloc(0))).toThrowError(
      ApiError
    );
  });

  it("accepts a tiny text file (fewer than 4 bytes)", () => {
    const tiny = Buffer.from("hi");
    expect(() => assertValidUpload("note.txt", tiny.length, tiny)).not.toThrow();
  });

  it("accepts a tiny markdown file (fewer than 4 bytes)", () => {
    const tiny = Buffer.from("#");
    expect(() => assertValidUpload("note.md", tiny.length, tiny)).not.toThrow();
  });

  it("still rejects a too-short binary file that claims to be PNG", () => {
    const tooShort = Buffer.from([0x89, 0x50]);
    try {
      assertValidUpload("img.png", tooShort.length, tooShort);
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as ApiError).code).toBe("UNSUPPORTED_TYPE");
    }
  });

  it("rejects an oversized file", () => {
    try {
      assertValidUpload("doc.pdf", MAX_FILE_BYTES + 1, PDF_BYTES);
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).code).toBe("FILE_TOO_LARGE");
    }
  });

  it("rejects a disallowed extension", () => {
    try {
      assertValidUpload("malware.exe", 10, Buffer.from("MZ........"));
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as ApiError).code).toBe("UNSUPPORTED_TYPE");
    }
  });

  it("rejects bytes that do not match the extension (spoofing)", () => {
    const notAPdf = Buffer.from("just plain text pretending to be a pdf");
    try {
      assertValidUpload("doc.pdf", notAPdf.length, notAPdf);
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as ApiError).code).toBe("UNSUPPORTED_TYPE");
    }
  });
});

describe("validateScanRequest", () => {
  it("accepts a known sampleId", () => {
    const fd = new FormData();
    fd.append("sampleId", "malicious-invoice");
    expect(validateScanRequest(fd)).toEqual({
      kind: "sample",
      sampleId: "malicious-invoice",
    });
  });

  it("rejects an unknown sampleId", () => {
    const fd = new FormData();
    fd.append("sampleId", "not-real");
    try {
      validateScanRequest(fd);
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as ApiError).code).toBe("INVALID_INPUT");
    }
  });

  it("accepts a file upload", () => {
    const fd = new FormData();
    fd.append("file", new File([PDF_BYTES], "doc.pdf"));
    const result = validateScanRequest(fd);
    expect(result.kind).toBe("file");
  });

  it("rejects a request with neither file nor sampleId", () => {
    const fd = new FormData();
    expect(() => validateScanRequest(fd)).toThrowError(ApiError);
  });
});
