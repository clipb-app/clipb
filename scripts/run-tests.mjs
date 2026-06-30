import { readdir } from "node:fs/promises";
import path from "node:path";
import { createServer } from "vite";

const root = process.cwd();
const testsDir = path.join(root, "tests");

async function findTestFiles(dir) {
  const entries = await readdir(dir, {
    withFileTypes: true,
  });

  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        return findTestFiles(entryPath);
      }

      if (entry.isFile() && entry.name.endsWith(".test.ts")) {
        return [entryPath];
      }

      return [];
    }),
  );

  return files.flat().sort();
}

const testFiles = await findTestFiles(testsDir);

if (testFiles.length === 0) {
  throw new Error("No test files found.");
}

const server = await createServer({
  root,
  configFile: false,
  logLevel: "error",
  appType: "custom",
  server: {
    hmr: false,
    middlewareMode: true,
    ws: false,
  },
});

try {
  for (const file of testFiles) {
    const modulePath = `/${path.relative(root, file).split(path.sep).join("/")}`;
    await server.ssrLoadModule(modulePath);
  }
} finally {
  await server.close();
}
