import { test } from "node:test";
import assert from "node:assert/strict";
import { startClipboardChecks } from "../src/lib/clipboardWatcherEvents";

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

test("native events capture successive copies without browser timers or window focus", async () => {
  let tick!: () => void;
  let clipboard = "first copy";
  let unlistened = false;
  const saved: string[] = [];
  const stop = startClipboardChecks({
    listen: async (check) => {
      tick = check;
      return () => { unlistened = true; };
    },
    check: async () => { saved.push(clipboard); },
    onError: assert.fail,
  });
  await flush();
  clipboard = "second copy";
  tick();
  await flush();
  clipboard = "third copy";
  tick();
  await flush();
  stop();
  tick();
  await flush();
  assert.deepEqual(saved, ["first copy", "second copy", "third copy"]);
  assert.equal(unlistened, true);
});

test("busy capture coalesces pending ticks without concurrent writes", async () => {
  let tick!: () => void;
  let captures = 0;
  const first = deferred<void>();
  const stop = startClipboardChecks({
    listen: async (check) => { tick = check; return () => {}; },
    check: async () => {
      captures++;
      if (captures === 1) await first.promise;
    },
    onError: assert.fail,
  });
  await flush();
  tick();
  tick();
  tick();
  assert.equal(captures, 1);
  first.resolve();
  await flush();
  assert.equal(captures, 2);
  stop();
});

test("a clipboard error does not prevent the next native tick from capturing", async () => {
  let tick!: () => void;
  let captures = 0;
  const errors: unknown[] = [];
  const failure = new Error("clipboard temporarily busy");
  const stop = startClipboardChecks({
    listen: async (check) => { tick = check; return () => {}; },
    check: async () => {
      captures++;
      if (captures === 1) throw failure;
    },
    onError: (error) => errors.push(error),
  });
  await flush();
  tick();
  await flush();
  assert.equal(captures, 2);
  assert.deepEqual(errors, [failure]);
  stop();
});

test("stopping while a check runs discards its queued follow-up", async () => {
  let tick!: () => void;
  let captures = 0;
  const first = deferred<void>();
  const stop = startClipboardChecks({
    listen: async (check) => { tick = check; return () => {}; },
    check: async () => { captures++; await first.promise; },
    onError: assert.fail,
  });
  await flush();
  tick();
  stop();
  first.resolve();
  await flush();
  assert.equal(captures, 1);
});

test("cleanup handles a subscription that resolves after unmount", async () => {
  const subscription = deferred<() => void>();
  let unlistened = false;
  const stop = startClipboardChecks({
    listen: () => subscription.promise,
    check: async () => assert.fail("captured after unmount"),
    onError: assert.fail,
  });
  stop();
  subscription.resolve(() => { unlistened = true; });
  await flush();
  assert.equal(unlistened, true);
});

test("subscription failure is reported", async () => {
  const errors: unknown[] = [];
  const failure = new Error("event registration failed");
  const stop = startClipboardChecks({
    listen: async () => { throw failure; },
    check: async () => assert.fail("captured before subscription"),
    onError: (error) => errors.push(error),
  });
  await flush();
  assert.deepEqual(errors, [failure]);
  stop();
});

test("the background Web Lock is held until the watcher stops", async () => {
  let released = false;
  let requestedName = "";
  const locks = {
    request: async (name: string, options: LockOptions, callback: LockGrantedCallback) => {
      requestedName = name;
      assert.equal(options.ifAvailable, true);
      await callback({ name, mode: "exclusive" });
      released = true;
    },
  } as Pick<LockManager, "request">;
  const stop = startClipboardChecks({
    listen: async () => () => {},
    check: async () => {},
    onError: assert.fail,
    locks,
  });
  await flush();
  assert.equal(requestedName, "clipb-clipboard-capture");
  assert.equal(released, false);
  stop();
  await flush();
  assert.equal(released, true);
});

test("unavailable and late locks do not leak or stop native checks", async () => {
  for (const available of [false, true]) {
    const granted = deferred<void>();
    let released = false;
    const locks = {
      request: async (name: string, _options: LockOptions, callback: LockGrantedCallback) => {
        await granted.promise;
        await callback(available ? { name, mode: "exclusive" } : null);
        released = true;
      },
    } as Pick<LockManager, "request">;
    const stop = startClipboardChecks({
      listen: async () => () => {},
      check: async () => {},
      onError: assert.fail,
      locks,
    });
    if (available) stop();
    granted.resolve();
    await flush();
    assert.equal(released, true);
    stop();
  }
});

test("lock rejection is reported without preventing event capture", async () => {
  let captured = false;
  const failure = new Error("Web Locks unavailable");
  const errors: unknown[] = [];
  const stop = startClipboardChecks({
    listen: async () => () => {},
    check: async () => { captured = true; },
    onError: (error) => errors.push(error),
    locks: { request: async () => { throw failure; } },
  });
  await flush();
  assert.equal(captured, true);
  assert.deepEqual(errors, [failure]);
  stop();
});
