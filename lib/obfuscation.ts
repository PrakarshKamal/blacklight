import sharp from "sharp";

export type ObfuscationFinding = {
  detected: boolean;
  description: string;
  /** Approximate % of image covered by large near-white blocks */
  coveragePercent: number;
  /** Footer-focused concealment (common injection hide pattern) */
  footerConcealment: boolean;
};

const NEAR_WHITE = 248;
const GRID = 24;

/**
 * Detect large near-white rectangles (e.g. white box drawn over text).
 * Cannot recover erased pixels — only flags likely visual concealment.
 */
export async function detectVisualObfuscation(
  buffer: Buffer
): Promise<ObfuscationFinding> {
  const { data, info } = await sharp(buffer, { failOn: "none" })
    .rotate()
    .resize(800, null, { withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const cellW = Math.ceil(width / GRID);
  const cellH = Math.ceil(height / GRID);
  const whiteCells: boolean[][] = [];

  for (let gy = 0; gy < GRID; gy++) {
    whiteCells[gy] = [];
    for (let gx = 0; gx < GRID; gx++) {
      let sum = 0;
      let count = 0;
      const x0 = gx * cellW;
      const y0 = gy * cellH;
      const x1 = Math.min(x0 + cellW, width);
      const y1 = Math.min(y0 + cellH, height);

      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * width + x) * channels;
          const r = data[i];
          const g = data[i + 1] ?? r;
          const b = data[i + 2] ?? r;
          const lum = (r + g + b) / 3;
          sum += lum;
          count++;
        }
      }
      whiteCells[gy][gx] = count > 0 && sum / count >= NEAR_WHITE;
    }
  }

  let whiteCellCount = 0;
  let footerWhiteCount = 0;
  let footerTotal = 0;
  const footerStartRow = Math.floor(GRID * 0.55);

  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      if (whiteCells[gy][gx]) {
        whiteCellCount++;
        if (gy >= footerStartRow) footerWhiteCount++;
      }
      if (gy >= footerStartRow) footerTotal++;
    }
  }

  const coveragePercent = Math.round((whiteCellCount / (GRID * GRID)) * 100);
  const footerWhiteRatio =
    footerTotal > 0 ? footerWhiteCount / footerTotal : 0;

  // Large white band in lower doc + not entire page blank (invoice body has content)
  const bodyRows = GRID - footerStartRow;
  let bodyHasContent = false;
  for (let gy = 0; gy < footerStartRow; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      if (!whiteCells[gy][gx]) {
        bodyHasContent = true;
        break;
      }
    }
    if (bodyHasContent) break;
  }

  const footerConcealment =
    bodyHasContent && footerWhiteRatio >= 0.72 && bodyRows >= 4;

  const largeWhiteBlock =
    coveragePercent >= 18 && footerConcealment;

  const detected = largeWhiteBlock || (footerConcealment && coveragePercent >= 12);

  return {
    detected,
    description: detected
      ? "Large near-white region detected — possible text concealment (white overlay)."
      : "No significant white-cover obfuscation detected.",
    coveragePercent,
    footerConcealment,
  };
}
