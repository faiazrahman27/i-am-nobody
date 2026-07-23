import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const EXPECTED_COVER = Object.freeze({
  relativePath: path.join("public", "book-cover.png"),
  width: 906,
  height: 1280,
  sha256:
    "ad76f01fa5a6160eaca1706ba7569f06040c1e2921bf50f2ddad450d72dc0f17",
});


const EXPECTED_BACKGROUND = Object.freeze({
  relativePath: path.join("public", "nobody-canonical-background.png"),
  width: 906,
  height: 1280,
  sha256:
    "16097bdce616139f2d6029c452f114f7637365ba620500c2c8a271e0afa4fbfc",
});

const EXPECTED_SUBJECT_MATTE = Object.freeze({
  relativePath: path.join("public", "nobody-subject-matte.png"),
  width: 906,
  height: 1280,
  sha256:
    "d37521d6f4c8d7c3b57317fa019d7d3cc91418a0d50b2499bf70afd4581692a0",
});

const EXPECTED_HELMET = Object.freeze({
  relativePath: path.join(
    "public",
    "nobody-canonical-helmet.png",
  ),
  width: 285,
  height: 355,
  sha256:
    "1ce0437c8697e17d0cd454576a5ae08085eb39b2b9634d6670ceb240fc0a6318",
});

function readPngDimensions(buffer, relativePath) {
  const pngSignature = Buffer.from([
    137, 80, 78, 71, 13, 10, 26, 10,
  ]);

  if (
    buffer.length < 24 ||
    !buffer.subarray(0, 8).equals(pngSignature)
  ) {
    throw new Error(`${relativePath} is not a valid PNG file.`);
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

async function validatePng(expected) {
  const absolutePath = path.join(
    process.cwd(),
    expected.relativePath,
  );

  const file = await readFile(absolutePath);
  const dimensions = readPngDimensions(
    file,
    expected.relativePath,
  );
  const sha256 = createHash("sha256")
    .update(file)
    .digest("hex");

  const errors = [];

  if (
    dimensions.width !== expected.width ||
    dimensions.height !== expected.height
  ) {
    errors.push(
      `${expected.relativePath}: expected ${expected.width}x${expected.height}, received ${dimensions.width}x${dimensions.height}.`,
    );
  }

  if (sha256 !== expected.sha256) {
    errors.push(
      `${expected.relativePath}: expected SHA-256 ${expected.sha256}, received ${sha256}.`,
    );
  }

  return {
    ...dimensions,
    sha256,
    errors,
  };
}

async function main() {
  const [cover, helmet, background, subjectMatte] = await Promise.all([
    validatePng(EXPECTED_COVER),
    validatePng(EXPECTED_HELMET),
    validatePng(EXPECTED_BACKGROUND),
    validatePng(EXPECTED_SUBJECT_MATTE),
  ]);

  const errors = [
    ...cover.errors,
    ...helmet.errors,
    ...background.errors,
    ...subjectMatte.errors,
  ];

  if (errors.length > 0) {
    throw new Error(
      [
        "I AM NOBODY canonical asset validation failed.",
        ...errors,
        "Do not replace any canonical cover, helmet, background, or subject-matte asset silently. Update the approved asset version and checksum only after explicit creative approval.",
      ].join("\n"),
    );
  }

  const aspectRatio = cover.width / cover.height;

  console.log(
    [
      `I AM NOBODY canonical cover validated: ${cover.width}x${cover.height}, ratio ${aspectRatio.toFixed(8)}, SHA-256 ${cover.sha256}.`,
      `Canonical helmet validated: ${helmet.width}x${helmet.height}, SHA-256 ${helmet.sha256}.`,
      `Canonical background validated: ${background.width}x${background.height}, SHA-256 ${background.sha256}.`,
      `Canonical subject matte validated: ${subjectMatte.width}x${subjectMatte.height}, SHA-256 ${subjectMatte.sha256}.`,
    ].join("\n"),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
