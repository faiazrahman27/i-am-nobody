import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const EXPECTED = Object.freeze({
  relativePath: path.join("public", "book-cover.png"),
  width: 906,
  height: 1280,
  sha256:
    "ad76f01fa5a6160eaca1706ba7569f06040c1e2921bf50f2ddad450d72dc0f17",
});

function readPngDimensions(buffer) {
  const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  if (buffer.length < 24 || !buffer.subarray(0, 8).equals(pngSignature)) {
    throw new Error(`${EXPECTED.relativePath} is not a valid PNG file.`);
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

async function main() {
  const absolutePath = path.join(process.cwd(), EXPECTED.relativePath);
  const file = await readFile(absolutePath);
  const dimensions = readPngDimensions(file);
  const sha256 = createHash("sha256").update(file).digest("hex");

  const errors = [];

  if (
    dimensions.width !== EXPECTED.width ||
    dimensions.height !== EXPECTED.height
  ) {
    errors.push(
      `Expected ${EXPECTED.width}x${EXPECTED.height}, received ${dimensions.width}x${dimensions.height}.`,
    );
  }

  if (sha256 !== EXPECTED.sha256) {
    errors.push(
      `The canonical cover checksum changed. Expected ${EXPECTED.sha256}, received ${sha256}.`,
    );
  }

  if (errors.length > 0) {
    throw new Error(
      [
        "I AM NOBODY canonical cover validation failed.",
        ...errors,
        "Do not replace public/book-cover.png silently. Update the brand reference version and checksum only after explicit creative approval.",
      ].join("\n"),
    );
  }

  const aspectRatio = dimensions.width / dimensions.height;

  console.log(
    `I AM NOBODY canonical cover validated: ${dimensions.width}x${dimensions.height}, ratio ${aspectRatio.toFixed(
      8,
    )}, SHA-256 ${sha256}.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});