import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  readReleaseVersions,
  validateReleaseVersions,
} from "../scripts/check-release-version.mjs";

const script = fileURLToPath(new URL("../scripts/check-release-version.mjs", import.meta.url));

function versions(version = "0.8.4") {
  return {
    "package.json": version,
    "src-tauri/tauri.conf.json": version,
    "src-tauri/Cargo.toml": version,
    "src-tauri/Cargo.lock": version,
  };
}

function fixture(t: TestContext, version = "0.8.4") {
  const root = mkdtempSync(join(tmpdir(), "clipb-release-version-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "src-tauri"));
  writeFileSync(join(root, "package.json"), JSON.stringify({ version }));
  writeFileSync(join(root, "src-tauri/tauri.conf.json"), JSON.stringify({ version }));
  writeFileSync(join(root, "src-tauri/Cargo.toml"), `
[package]
name = 'clipb-app'
version = '${version}'
[dependencies]
tauri = { version = '2.11.3' }
`);
  writeFileSync(join(root, "src-tauri/Cargo.lock"), `
version = 4
[[package]]
name = 'unrelated-library'
version = '1.0.0'
[[package]]
name = 'clipb-app'
version = '${version}'
[[package]]
name = 'clipb-app'
version = '9.0.0'
source = 'registry+https://github.com/rust-lang/crates.io-index'
`);
  return root;
}

test("release version reader selects app metadata rather than dependencies or the lockfile format", (t) => {
  assert.deepEqual(readReleaseVersions(fixture(t)), versions());
});

test("release validation accepts matching app versions with or without a tag", () => {
  assert.equal(validateReleaseVersions(versions()), "0.8.4");
  assert.equal(validateReleaseVersions(versions(), "v0.8.4"), "0.8.4");
});

test("release validation rejects the v0.8.3 tag with 0.8.2 app metadata", () => {
  assert.throws(
    () => validateReleaseVersions(versions("0.8.2"), "v0.8.3"),
    /Release tag v0\.8\.3 does not match app version 0\.8\.2/,
  );
});

test("every app version file must agree, including Cargo.lock", () => {
  for (const file of Object.keys(versions())) {
    assert.throws(
      () => validateReleaseVersions({ ...versions(), [file]: "0.8.2" }),
      /does not match package\.json/,
    );
  }
});

test("beta tags must match the exact prerelease version", () => {
  const beta = versions("0.8.4-beta.1");
  assert.equal(validateReleaseVersions(beta, "v0.8.4-beta.1"), "0.8.4-beta.1");
  for (const tag of ["v0.8.4", "v0.8.4-beta.2"]) {
    assert.throws(() => validateReleaseVersions(beta, tag), /does not match app version/);
  }
  assert.throws(
    () => validateReleaseVersions(versions(), "v0.8.4-beta.1"),
    /does not match app version/,
  );
});

test("malformed tags and missing or invalid version fields fail validation", () => {
  for (const tag of ["", "0.8.4", "v.0.8.4", "v0.8", "v01.8.4", "main", "v0.8.4\n", "v0.8.4;echo hello"]) {
    assert.throws(() => validateReleaseVersions(versions(), tag), /Invalid release tag/);
  }
  for (const version of [undefined, null, 84, "", "v0.8.4", "0.8", "01.8.4", "0.8.4-beta.01"]) {
    assert.throws(
      () => validateReleaseVersions({ ...versions(), "src-tauri/Cargo.toml": version }),
      /src-tauri\/Cargo\.toml: invalid app version/,
    );
  }
});

test("the lockfile must contain one local app entry", (t) => {
  const root = fixture(t);
  for (const packages of ["", `
[[package]]
name = 'clipb-app'
version = '0.8.4'
[[package]]
name = 'clipb-app'
version = '0.8.2'
`]) {
    writeFileSync(join(root, "src-tauri/Cargo.lock"), `version = 4\n${packages}`);
    assert.throws(() => readReleaseVersions(root), /exactly one local app package/);
  }
});

test("release-check CLI exits successfully for a valid checkout", (t) => {
  const root = fixture(t);
  for (const args of [[], ["--tag", "v0.8.4"]]) {
    const result = spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /All app version files match 0\.8\.4/);
  }
});

test("release-check CLI blocks a mismatched tag and malformed arguments", (t) => {
  const root = fixture(t, "0.8.2");
  const mismatch = spawnSync(process.execPath, [script, "--tag", "v0.8.3"], { cwd: root, encoding: "utf8" });
  assert.equal(mismatch.status, 1);
  assert.match(mismatch.stderr, /does not match app version 0\.8\.2/);

  for (const args of [["--tag"], ["v0.8.4"], ["--tag", "v0.8.4", "extra"]]) {
    const result = spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: "utf8" });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Usage:/);
  }
});
