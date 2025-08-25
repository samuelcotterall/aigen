// Test setup: ensure test environment looks like a TTY so interactive
// prompt libraries (Enquirer) initialize without throwing when run in
// a headless test runner.
// Keep this minimal and safe: only set the `isTTY` flags which affect
// many prompt libraries' runtime checks.
// Try to set `isTTY` on existing stdio objects. In some test runner
// environments `process.stdin` is a read-only getter, so assign via
// Object.defineProperty when possible.
try {
  if (process.stdin) {
    try {
      Object.defineProperty(process.stdin as any, "isTTY", {
        value: true,
        configurable: true,
        writable: false,
      });
    } catch {
      // ignore if environment prevents defining
    }
  }
  if (process.stdout) {
    try {
      Object.defineProperty(process.stdout as any, "isTTY", {
        value: true,
        configurable: true,
        writable: false,
      });
    } catch {}
  }
} catch {}
