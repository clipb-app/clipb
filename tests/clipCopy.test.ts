import { test } from "node:test";
import assert from "node:assert/strict";
import type { Clip, ClipContentType, ClipCategory } from "../src/types";
import {
  bytesToBlob,
  copyImageClipWithAdapters,
  copyClipToClipboard,
  copyClipToClipboardWithAdapters,
  decodeImageToRgbaBytes,
  getImageMime,
  getCopyLabel,
  getCopyTitle,
  type DecodedImageData,
  type ImageClipCopyAdapters,
} from "../src/lib/clipCopy";

function clip(overrides: Partial<Clip>): Clip {
  return {
    id: 1,
    content: "Copied content",
    content_hash: "hash",
    content_type: "text/plain",
    category: "text",
    note: null,
    asset_path: null,
    asset_name: null,
    asset_size: null,
    asset_mime: null,
    created_at: 1,
    updated_at: 1,
    is_pinned: 0,
    is_favorite: 0,
    ...overrides,
  };
}

function adapters(calls: string[]) {
  return {
    writeText: async (text: string) => {
      calls.push(`text:${text}`);
    },
    writeImageClip: async (clip: Clip) => {
      calls.push(`image:${clip.asset_path ?? ""}`);
    },
    writeFilePaths: async (paths: string[]) => {
      calls.push(`files:${paths.join("|")}`);
    },
  };
}

function imageCopyAdapters(
  calls: string[],
  overrides: Partial<ImageClipCopyAdapters> = {},
): ImageClipCopyAdapters {
  return {
    writeNativeImageFile: async (path: string) => {
      calls.push(`native:${path}`);
    },
    readImageFile: async (path: string) => {
      calls.push(`read:${path}`);
      return new Uint8Array([1, 2, 3]);
    },
    decodeImage: async (bytes: Uint8Array, mime: string) => {
      calls.push(`decode:${mime}:${Array.from(bytes).join(",")}`);
      return {
        rgba: new Uint8Array([4, 5, 6, 7]),
        width: 1,
        height: 1,
      };
    },
    hashImageBytes: async (bytes: Uint8Array) => {
      calls.push(`hash:${Array.from(bytes).join(",")}`);
      return "image-hash";
    },
    suppressFilePaths: (paths: string[]) => {
      calls.push(`suppress-files:${paths.join("|")}`);
    },
    suppressImageHash: (hash: string) => {
      calls.push(`suppress-image:${hash}`);
    },
    writeDecodedImage: async (image: DecodedImageData) => {
      calls.push(`write-decoded:${image.width}x${image.height}`);
    },
    logDebug: (message: string, error: unknown) => {
      calls.push(`debug:${message}:${String(error)}`);
    },
    ...overrides,
  };
}

test("copies text clips as text", async () => {
  const calls: string[] = [];

  await copyClipToClipboardWithAdapters(
    clip({ content: "hello" }),
    adapters(calls),
  );

  assert.deepEqual(calls, ["text:hello"]);
});

test("copies image clips with the image writer", async () => {
  const calls: string[] = [];

  await copyClipToClipboardWithAdapters(
    clip({
      category: "image",
      content_type: "image/png",
      asset_path: "/tmp/image.png",
    }),
    adapters(calls),
  );

  assert.deepEqual(calls, ["image:/tmp/image.png"]);
});

test("copies image clips with the native image file writer first", async () => {
  const calls: string[] = [];

  await copyImageClipWithAdapters(
    clip({
      category: "image",
      content_type: "image/png",
      asset_path: "/tmp/image.png",
    }),
    imageCopyAdapters(calls),
  );

  assert.deepEqual(calls, [
    "suppress-files:/tmp/image.png",
    "native:/tmp/image.png",
  ]);
});

test("falls back to decoded image copy when native image file copy fails", async () => {
  const calls: string[] = [];

  await copyImageClipWithAdapters(
    clip({
      category: "image",
      content_type: "application/octet-stream",
      asset_mime: "image/webp",
      asset_path: "/tmp/image.webp",
    }),
    imageCopyAdapters(calls, {
      writeNativeImageFile: async (path: string) => {
        calls.push(`native:${path}`);
        throw new Error("native unavailable");
      },
    }),
  );

  assert.deepEqual(calls, [
    "suppress-files:/tmp/image.webp",
    "native:/tmp/image.webp",
    "debug:Native image file clipboard copy failed::Error: native unavailable",
    "read:/tmp/image.webp",
    "decode:image/webp:1,2,3",
    "hash:4,5,6,7",
    "suppress-image:image-hash",
    "write-decoded:1x1",
  ]);
});

test("image copy helpers choose safe MIME values", () => {
  assert.equal(
    getImageMime(
      clip({
        content_type: "application/octet-stream",
        asset_mime: "image/jpeg",
      }),
    ),
    "image/jpeg",
  );
  assert.equal(
    getImageMime(
      clip({
        content_type: "image/gif",
        asset_mime: "application/octet-stream",
      }),
    ),
    "image/gif",
  );
  assert.equal(
    getImageMime(
      clip({
        content_type: "application/octet-stream",
        asset_mime: null,
      }),
    ),
    "image/png",
  );

  const source = new Uint8Array([9, 8, 7]);
  const blob = bytesToBlob(source, "image/png");
  source[0] = 1;

  assert.equal(blob.type, "image/png");
  assert.equal(blob.size, 3);
});

test("decodes browser image blobs into RGBA bytes", async () => {
  const browser = installImageDecodeEnvironment({
    width: 2,
    height: 1,
    rgba: new Uint8ClampedArray([1, 2, 3, 4, 5, 6, 7, 8]),
  });

  try {
    const decoded = await decodeImageToRgbaBytes(
      new Blob([new Uint8Array([1, 2, 3])], {
        type: "image/png",
      }),
    );

    assert.deepEqual(decoded, {
      rgba: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]),
      width: 2,
      height: 1,
    });
    assert.deepEqual(browser.calls, [
      "create-url:image/png:3",
      "decode:blob:test",
      "draw:2x1",
      "get-image-data:2x1",
      "revoke-url:blob:test",
    ]);
  } finally {
    browser.restore();
  }
});

test("image decoding rejects invalid browser image state", async () => {
  const invalidImage = installImageDecodeEnvironment({
    width: 0,
    height: 1,
    rgba: new Uint8ClampedArray([]),
  });

  try {
    await assert.rejects(
      () => decodeImageToRgbaBytes(new Blob()),
      /Image has invalid dimensions/,
    );
  } finally {
    invalidImage.restore();
  }

  const missingContext = installImageDecodeEnvironment({
    width: 1,
    height: 1,
    rgba: new Uint8ClampedArray([1, 2, 3, 4]),
    missingContext: true,
  });

  try {
    await assert.rejects(
      () => decodeImageToRgbaBytes(new Blob()),
      /Could not create image canvas context/,
    );
  } finally {
    missingContext.restore();
  }
});

test("copies path-only file clips as file references", async () => {
  const calls: string[] = [];

  await copyClipToClipboardWithAdapters(
    clip({
      category: "file",
      content_type: "file/path",
      content: "/Users/me/Desktop/report.pdf",
    }),
    adapters(calls),
  );

  assert.deepEqual(calls, ["files:/Users/me/Desktop/report.pdf"]);
});

test("copies backed-up file clips from the local asset path", async () => {
  const calls: string[] = [];

  await copyClipToClipboardWithAdapters(
    clip({
      category: "file",
      content_type: "file/backup",
      content: "/missing/original.pdf",
      asset_path: "/Users/me/Library/Application Support/com.clipb.app/assets/report.pdf",
    }),
    adapters(calls),
  );

  assert.deepEqual(calls, [
    "files:/Users/me/Library/Application Support/com.clipb.app/assets/report.pdf",
  ]);
});

test("rejects malformed file clips before touching the OS clipboard", async () => {
  await assert.rejects(
    () =>
      copyClipToClipboardWithAdapters(
        clip({
          category: "file" as ClipCategory,
          content_type: "file/path" as ClipContentType,
          content: "",
        }),
        adapters([]),
      ),
    /No file path available/,
  );
});

test("rejects image clips that no longer have a local asset", async () => {
  await assert.rejects(
    () =>
      copyImageClipWithAdapters(
        clip({
          category: "image",
          content_type: "image/png",
          asset_path: null,
        }),
        imageCopyAdapters([]),
      ),
    /No image asset path available/,
  );

  await assert.rejects(
    () =>
      copyClipToClipboard(
        clip({
          category: "image",
          content_type: "image/png",
          asset_path: null,
        }),
      ),
    /No image asset path available/,
  );
});

test("returns copy labels for rich clips", () => {
  assert.equal(getCopyLabel(clip({}), false), "Copy");
  assert.equal(getCopyLabel(clip({ category: "image" }), false), "Copy image");
  assert.equal(getCopyLabel(clip({ category: "file" }), false), "Copy file");
  assert.equal(getCopyLabel(clip({}), true), "Copied");
});

test("returns copy titles for rich clips", () => {
  assert.equal(getCopyTitle(clip({}), false), "Copy clip");
  assert.equal(
    getCopyTitle(clip({ category: "image" }), false),
    "Copy image to clipboard",
  );
  assert.equal(
    getCopyTitle(clip({ category: "file" }), false),
    "Copy file to clipboard",
  );
  assert.equal(getCopyTitle(clip({}), true), "Copied");
});

function installImageDecodeEnvironment(options: {
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
  missingContext?: boolean;
}) {
  const globalObject = globalThis as typeof globalThis & {
    window?: unknown;
    document?: unknown;
    URL: typeof URL;
  };
  const originalWindow = globalObject.window;
  const originalDocument = globalObject.document;
  const originalCreateObjectUrl = globalObject.URL.createObjectURL;
  const originalRevokeObjectUrl = globalObject.URL.revokeObjectURL;
  const calls: string[] = [];

  class MockImage {
    decoding = "";
    src = "";
    naturalWidth = options.width;
    naturalHeight = options.height;

    async decode() {
      calls.push(`decode:${this.src}`);
    }
  }

  Object.defineProperty(globalObject, "window", {
    configurable: true,
    value: {
      Image: MockImage,
    },
  });

  Object.defineProperty(globalObject, "document", {
    configurable: true,
    value: {
      createElement: (tag: string) => {
        assert.equal(tag, "canvas");

        return {
          width: 0,
          height: 0,
          getContext: (type: string) => {
            assert.equal(type, "2d");

            if (options.missingContext) return null;

            return {
              drawImage: (_image: unknown, _x: number, _y: number) => {
                calls.push(`${"draw"}:${options.width}x${options.height}`);
              },
              getImageData: (
                _x: number,
                _y: number,
                width: number,
                height: number,
              ) => {
                calls.push(`get-image-data:${width}x${height}`);

                return {
                  data: options.rgba,
                };
              },
            };
          },
        };
      },
    },
  });

  Object.defineProperty(globalObject.URL, "createObjectURL", {
    configurable: true,
    value: (blob: Blob) => {
      calls.push(`create-url:${blob.type}:${blob.size}`);
      return "blob:test";
    },
  });

  Object.defineProperty(globalObject.URL, "revokeObjectURL", {
    configurable: true,
    value: (url: string) => {
      calls.push(`revoke-url:${url}`);
    },
  });

  return {
    calls,
    restore() {
      Object.defineProperty(globalObject, "window", {
        configurable: true,
        value: originalWindow,
      });
      Object.defineProperty(globalObject, "document", {
        configurable: true,
        value: originalDocument,
      });
      Object.defineProperty(globalObject.URL, "createObjectURL", {
        configurable: true,
        value: originalCreateObjectUrl,
      });
      Object.defineProperty(globalObject.URL, "revokeObjectURL", {
        configurable: true,
        value: originalRevokeObjectUrl,
      });
    },
  };
}
