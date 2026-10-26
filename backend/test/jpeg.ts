// Hand-built JPEG headers for the AD-11 crop checks; no image files needed.

export function segment(marker: number, payload: number[] | Buffer): Buffer {
  const body = Buffer.from(payload);
  const len = body.length + 2;
  return Buffer.concat([
    Buffer.from([0xff, marker, len >> 8, len & 0xff]),
    body,
  ]);
}

/** A SOFn segment (baseline SOF0 by default) for a 3-component image. */
export function sof(width: number, height: number, marker = 0xc0): Buffer {
  return segment(marker, [
    8,
    height >> 8,
    height & 0xff,
    width >> 8,
    width & 0xff,
    3,
    1,
    0x22,
    0,
    2,
    0x11,
    1,
    3,
    0x11,
    1,
  ]);
}

const app0 = segment(0xe0, [
  ...Buffer.from("JFIF\0"),
  1,
  1,
  1,
  0,
  0x60,
  0,
  0x60,
  0,
  0,
]);
const dqt = segment(0xdb, [0, ...Array<number>(64).fill(1)]);
const sos = segment(0xda, [1, 1, 0, 0, 0x3f, 0]);

/** SOI, the segments, a stub scan, EOI. */
export function jpeg(...segments: Buffer[]): Buffer {
  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    ...segments,
    sos,
    Buffer.from([0x12, 0x34, 0xff, 0xd9]),
  ]);
}

/** Shaped like simulator/assets/placeholder-crop.jpg: JFIF, DQT, then a 64x48 baseline SOF0. */
export const placeholder = jpeg(app0, dqt, sof(64, 48));

/** An EXIF APP1 holding a 16x16 thumbnail, before a 640x480 main SOF. */
export const exifThumb = jpeg(
  segment(0xe1, Buffer.concat([Buffer.from("Exif\0\0"), jpeg(sof(16, 16))])),
  sof(640, 480),
);

export const crop = (buf: Buffer) => ({
  mime: "image/jpeg",
  data: buf.toString("base64"),
});
