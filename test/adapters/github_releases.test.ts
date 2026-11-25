// Tests rule 3: listing and downloading the releases of ghg, served on the loopback address.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { after, before, test } from "node:test";
import { GitHubGhgReleases, type ReleaseAddresses } from "../../src/adapters/github_releases.ts";

const requests: IncomingMessage[] = [];
let server: Server;
let addresses: ReleaseAddresses;

// 150 releases, so that the listing takes two pages, of 100 and 50.
const RELEASES = Array.from({ length: 150 }, (_, index) => ({
  tag_name: `v1.${index}.0`,
  draft: index === 149,
  prerelease: false,
  assets: [{ name: "SHA256SUMS" }],
}));

before(async () => {
  process.env["RUNNER_TEMP"] ??= tmpdir();
  server = createServer((request, response) => {
    requests.push(request);
    const url = new URL(request.url ?? "/", "http://localhost");
    if (url.pathname === "/api/releases") {
      const page = Number(url.searchParams.get("page"));
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify(RELEASES.slice((page - 1) * 100, page * 100)));
    } else if (url.pathname === "/broken/releases") {
      response.statusCode = 403;
      response.end("{}");
    } else if (url.pathname === "/downloads/v1.0.0/SHA256SUMS") {
      response.end("the sums\n");
    } else {
      response.statusCode = 404;
      response.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  addresses = { api: `${base}/api`, downloads: `${base}/downloads` };
});

after(() => server.close());

test("every page of releases is listed, with the token when there is one", async () => {
  requests.length = 0;
  const listed = await new GitHubGhgReleases(addresses, "a-token").listReleases();
  assert.equal(listed?.length, 150);
  assert.deepEqual(listed?.[149], { tag: "v1.149.0", draft: true, prerelease: false });
  assert.deepEqual(
    requests.map((request) => [request.url, request.headers.authorization]),
    [
      ["/api/releases?per_page=100&page=1", "Bearer a-token"],
      ["/api/releases?per_page=100&page=2", "Bearer a-token"],
    ],
  );
});

test("without a token, none is sent", async () => {
  requests.length = 0;
  await new GitHubGhgReleases(addresses, undefined).listReleases();
  assert.equal(requests[0]?.headers.authorization, undefined);
});

test("releases that cannot be listed give none", async () => {
  const broken = { ...addresses, api: addresses.api.replace("/api", "/broken") };
  assert.equal(await new GitHubGhgReleases(broken, undefined).listReleases(), undefined);
});

test("a release's file is downloaded under its own name", async () => {
  const file = await new GitHubGhgReleases(addresses, undefined).downloadFile("1.0.0", "SHA256SUMS");
  assert.ok(file !== undefined && file.endsWith("SHA256SUMS"));
  assert.equal(await readFile(file, "utf8"), "the sums\n");
});

test("a file the release does not have gives none", async () => {
  assert.equal(await new GitHubGhgReleases(addresses, undefined).downloadFile("1.0.0", "missing.zip"), undefined);
});
