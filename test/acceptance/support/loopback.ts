// Test support: the loopback address the stand-ins for GitHub listen on.

import { createServer } from "node:net";
import { setTimeout as sleep } from "node:timers/promises";

/** A port of the loopback address that nothing listens on now. */
export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => (typeof address === "object" && address !== null ? resolve(address.port) : reject(new Error("no port"))));
    });
  });
}

/** Waits until the condition holds, for at most a minute, which a starting Java may need. */
export async function waitUntil(condition: () => Promise<boolean>): Promise<void> {
  for (let tries = 0; tries < 600; tries++) {
    if (await condition()) return;
    await sleep(100);
  }
  throw new Error("The stand-in for GitHub did not start within a minute.");
}
