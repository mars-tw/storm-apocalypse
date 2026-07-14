import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";

export const LUMINANCE_MIN = 0.22;
export const LUMINANCE_MAX = 0.75;
export const NEAR_BLACK_LIMIT = 0.08;
export const NEAR_BLACK_SHARE_MAX = 0.40;

const defaultRoot = fileURLToPath(new URL("..", import.meta.url));
const gatedFiles = [
  ...["butcher-matron", "vet-sniper", "mech-youth"].flatMap((hero) => [
    `public/images/characters/protagonist-${hero}.png`,
    `public/images/characters/protagonist-${hero}-medium.png`,
    `public/images/characters/protagonist-${hero}-low.png`,
  ]),
  "public/images/ui/background/menu-background.png",
  "public/images/ui/background/menu-background-medium.png",
  "public/images/ui/background/menu-background-low.png",
];

function paeth(left, above, upperLeft) {
  const prediction = left + above - upperLeft;
  const leftDistance = Math.abs(prediction - left);
  const aboveDistance = Math.abs(prediction - above);
  const upperLeftDistance = Math.abs(prediction - upperLeft);
  if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) return left;
  return aboveDistance <= upperLeftDistance ? above : upperLeft;
}

function decodePng(data) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!data.subarray(0, 8).equals(signature)) throw new Error("not a PNG");
  let width;
  let height;
  let bitDepth;
  let colorType;
  let interlace;
  let palette;
  let transparency;
  const imageChunks = [];
  for (let offset = 8; offset < data.length;) {
    const length = data.readUInt32BE(offset);
    const type = data.toString("ascii", offset + 4, offset + 8);
    const chunk = data.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = chunk.readUInt32BE(0);
      height = chunk.readUInt32BE(4);
      bitDepth = chunk[8];
      colorType = chunk[9];
      interlace = chunk[12];
    } else if (type === "PLTE") palette = chunk;
    else if (type === "tRNS") transparency = chunk;
    else if (type === "IDAT") imageChunks.push(chunk);
    offset += length + 12;
    if (type === "IEND") break;
  }
  if (!width || !height || bitDepth !== 8 || interlace !== 0) {
    throw new Error(`unsupported PNG layout (${width ?? 0}x${height ?? 0}, depth=${bitDepth}, interlace=${interlace})`);
  }
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  if (!channels) throw new Error(`unsupported PNG color type ${colorType}`);
  const rowBytes = width * channels;
  const inflated = inflateSync(Buffer.concat(imageChunks));
  if (inflated.length !== height * (rowBytes + 1)) throw new Error("unexpected PNG scanline length");
  const raw = Buffer.alloc(height * rowBytes);
  for (let row = 0; row < height; row += 1) {
    const sourceStart = row * (rowBytes + 1);
    const filter = inflated[sourceStart];
    const destinationStart = row * rowBytes;
    for (let column = 0; column < rowBytes; column += 1) {
      const byte = inflated[sourceStart + 1 + column];
      const left = column >= channels ? raw[destinationStart + column - channels] : 0;
      const above = row > 0 ? raw[destinationStart + column - rowBytes] : 0;
      const upperLeft = row > 0 && column >= channels ? raw[destinationStart + column - rowBytes - channels] : 0;
      const reconstructed = filter === 0 ? byte
        : filter === 1 ? byte + left
          : filter === 2 ? byte + above
            : filter === 3 ? byte + Math.floor((left + above) / 2)
              : filter === 4 ? byte + paeth(left, above, upperLeft)
                : Number.NaN;
      if (!Number.isFinite(reconstructed)) throw new Error(`unsupported PNG filter ${filter}`);
      raw[destinationStart + column] = reconstructed & 0xff;
    }
  }
  return { width, height, colorType, channels, palette, transparency, raw };
}

function rgbaAt(image, offset) {
  const { colorType, palette, raw, transparency } = image;
  if (colorType === 6) return [raw[offset], raw[offset + 1], raw[offset + 2], raw[offset + 3]];
  if (colorType === 2) return [raw[offset], raw[offset + 1], raw[offset + 2], 255];
  if (colorType === 4) return [raw[offset], raw[offset], raw[offset], raw[offset + 1]];
  if (colorType === 0) return [raw[offset], raw[offset], raw[offset], transparency?.[1] === raw[offset] ? 0 : 255];
  const index = raw[offset];
  return [palette[index * 3], palette[index * 3 + 1], palette[index * 3 + 2], transparency?.[index] ?? 255];
}

export async function checkPortraitLuminance(root = defaultRoot) {
  const measurements = [];
  for (const relative of gatedFiles) {
    try {
      const image = decodePng(await readFile(resolve(root, relative)));
      let opaquePixels = 0;
      let luminanceTotal = 0;
      let nearBlackPixels = 0;
      for (let offset = 0; offset < image.raw.length; offset += image.channels) {
        const [red, green, blue, alpha] = rgbaAt(image, offset);
        if (alpha < 128) continue;
        const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
        opaquePixels += 1;
        luminanceTotal += luminance;
        if (luminance < NEAR_BLACK_LIMIT) nearBlackPixels += 1;
      }
      if (opaquePixels === 0) throw new Error("contains no opaque pixels");
      const mean = luminanceTotal / opaquePixels;
      const nearBlackShare = nearBlackPixels / opaquePixels;
      measurements.push({
        relative,
        mean,
        nearBlackShare,
        pass: mean >= LUMINANCE_MIN && mean <= LUMINANCE_MAX && nearBlackShare < NEAR_BLACK_SHARE_MAX,
      });
    } catch (error) {
      measurements.push({ relative, mean: 0, nearBlackShare: 1, pass: false, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return {
    pass: measurements.every((measurement) => measurement.pass),
    measurements,
    detail: measurements.map(({ relative, mean, nearBlackShare, error }) =>
      `${relative.split("/").at(-1)}=${error ?? `${mean.toFixed(3)}/${(nearBlackShare * 100).toFixed(1)}%`}`).join(", "),
  };
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  const result = await checkPortraitLuminance();
  for (const measurement of result.measurements) {
    console.log(`${measurement.pass ? "PASS" : "FAIL"} ${measurement.relative} — mean=${measurement.mean.toFixed(3)}, near-black=${(measurement.nearBlackShare * 100).toFixed(1)}%${measurement.error ? `, ${measurement.error}` : ""}`);
  }
  console.log(`${result.pass ? "PASS" : "FAIL"} R8.1 luminance gate — mean ${LUMINANCE_MIN}–${LUMINANCE_MAX}, near-black < ${(NEAR_BLACK_SHARE_MAX * 100).toFixed(0)}%`);
  if (!result.pass) process.exitCode = 1;
}
