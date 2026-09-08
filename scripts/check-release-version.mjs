import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import semver from "semver";
import { parse as parseToml } from "smol-toml";

export function readReleaseVersions(root = process.cwd()) {
  const read = (file) => readFileSync(resolve(root, file), "utf8");
  const frontend = JSON.parse(read("package.json"));
  const tauri = JSON.parse(read("src-tauri/tauri.conf.json"));
  const cargo = parseToml(read("src-tauri/Cargo.toml"));
  const lock = parseToml(read("src-tauri/Cargo.lock"));
  const appPackages = (lock.package ?? []).filter(
    (pkg) => pkg.name === cargo.package?.name && !pkg.source,
  );

  if (appPackages.length !== 1) {
    throw new Error("Cargo.lock must contain exactly one local app package. Regenerate it with cargo check.");
  }

  return {
    "package.json": frontend.version,
    "src-tauri/tauri.conf.json": tauri.version,
    "src-tauri/Cargo.toml": cargo.package?.version,
    "src-tauri/Cargo.lock": appPackages[0].version,
  };
}

export function validateReleaseVersions(versions, tag) {
  const problems = [];
  const expected = versions["package.json"];

  for (const [file, version] of Object.entries(versions)) {
    if (typeof version !== "string" || semver.valid(version) !== version) {
      problems.push(`${file}: invalid app version ${JSON.stringify(version)}.`);
    } else if (version !== expected) {
      problems.push(`${file}: ${version} does not match package.json (${expected}).`);
    }
  }

  if (tag !== undefined) {
    if (typeof tag !== "string" || !tag.startsWith("v") || semver.valid(tag.slice(1)) !== tag.slice(1)) {
      problems.push(`Invalid release tag ${JSON.stringify(tag)}. Use v0.8.4 or v0.8.4-beta.1.`);
    } else if (tag !== `v${expected}`) {
      problems.push(`Release tag ${tag} does not match app version ${expected}. Update the version files before tagging.`);
    }
  }

  if (problems.length > 0) {
    throw new Error(`Release version check failed:\n${problems.join("\n")}`);
  }

  return expected;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 0 && (args.length !== 2 || args[0] !== "--tag")) {
      throw new Error("Usage: pnpm run release:check [--tag v0.8.4]");
    }
    const version = validateReleaseVersions(readReleaseVersions(), args[1]);
    console.log(`All app version files match ${version}${args[1] ? ` and tag ${args[1]}` : ""}.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
