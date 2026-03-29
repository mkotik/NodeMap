// Polyfill Web Streams API for jsdom (used by ai SDK)
const { TransformStream, ReadableStream, WritableStream } =
  require("node:stream/web") as typeof import("node:stream/web");
Object.assign(globalThis, { TransformStream, ReadableStream, WritableStream });

// Polyfill structuredClone for jsdom
if (typeof globalThis.structuredClone === "undefined") {
  globalThis.structuredClone = <T>(val: T): T =>
    JSON.parse(JSON.stringify(val));
}

// Auth env vars
process.env.JWT_ACCESS_SECRET = "test-access-secret";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
process.env.ACCESS_TOKEN_EXPIRY = "15m";
process.env.REFRESH_TOKEN_EXPIRY = "7d";
