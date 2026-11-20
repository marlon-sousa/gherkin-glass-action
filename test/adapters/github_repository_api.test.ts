// Tests docs/BEHAVIOUR.md, rules 20, 27 to 29: the repository through GitHub's API, served on the loopback address.

import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import { GitHubRepositoryApi } from "../../src/adapters/github_repository_api.ts";

const requests: { method: string; url: string; authorization: string; body: string }[] = [];
let server: Server;
let api: string;

// 150 files, so that the listing takes two pages, of 100 and 50.
const FILES = Array.from({ length: 150 }, (_, index) => ({
  filename: `features/${index}.feature`,
  status: index === 0 ? "removed" : "modified",
}));

before(async () => {
  server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => (body += chunk));
    request.on("end", () => {
      const url = new URL(request.url ?? "/", "http://localhost");
      requests.push({ method: request.method ?? "", url: url.pathname, authorization: request.headers.authorization ?? "", body });
      const reply = (status: number, value?: unknown) => {
        response.statusCode = status;
        response.end(value === undefined ? "" : JSON.stringify(value));
      };
      if (url.pathname === "/repos/owner/on/pages") {
        reply(200, { html_url: "https://owner.github.io/on/", build_type: "legacy", source: { branch: "gh-pages", path: "/" } });
      } else if (url.pathname === "/repos/owner/off/pages") reply(404, { message: "Not Found" });
      else if (url.pathname === "/repos/owner/forbidden/pages") reply(403, { message: "Resource not accessible by integration" });
      else if (url.pathname === "/repos/owner/on/pulls/12/files") {
        const page = Number(url.searchParams.get("page"));
        reply(200, FILES.slice((page - 1) * 100, page * 100));
      } else if (url.pathname === "/repos/owner/on/issues/12/comments" && request.method === "GET") {
        reply(200, [{ id: 7, body: "a comment", user: { login: "someone" } }]);
      } else if (url.pathname === "/repos/owner/on/issues/12/comments") reply(201, { id: 8 });
      else if (url.pathname === "/repos/owner/on/issues/comments/7") reply(200, { id: 7 });
      else if (url.pathname === "/repos/owner/on/compare/aaa...bbb") {
        reply(200, {
          status: "ahead",
          files: [{ filename: "features/new.feature", status: "renamed", previous_filename: "features/old.feature" }],
        });
      } else if (url.pathname === "/repos/owner/on/compare/aaa...ccc") reply(200, { status: "diverged", files: [] });
      else if (url.pathname === "/repos/owner/on/compare/aaa...ddd") reply(200, { status: "ahead", files: FILES.concat(FILES) });
      else reply(404);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  api = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => server.close());

test("Pages' settings are read with the token, and Pages that is off or unreadable told apart", async () => {
  requests.length = 0;
  assert.deepEqual(await new GitHubRepositoryApi(api, "owner/on", "a-token").pagesSettings(), {
    buildType: "legacy",
    branch: "gh-pages",
    path: "/",
    address: "https://owner.github.io/on/",
  });
  assert.equal(requests[0]?.authorization, "Bearer a-token");
  assert.equal(await new GitHubRepositoryApi(api, "owner/off", "a-token").pagesSettings(), "off");
  assert.equal(await new GitHubRepositoryApi(api, "owner/forbidden", "a-token").pagesSettings(), undefined);
});

test("every page of a pull request's files is listed, the removed ones told apart", async () => {
  const files = await new GitHubRepositoryApi(api, "owner/on", "a-token").listChangedFiles(12);
  assert.equal(files?.length, 150);
  assert.deepEqual(files?.[0], { path: "features/0.feature", removed: true });
  assert.deepEqual(files?.[149], { path: "features/149.feature", removed: false });
  assert.equal(await new GitHubRepositoryApi(api, "owner/off", "a-token").listChangedFiles(12), undefined);
});

test("comments are listed, added and edited", async () => {
  const repository = new GitHubRepositoryApi(api, "owner/on", "a-token");
  assert.deepEqual(await repository.listComments(12), [{ id: 7, body: "a comment" }]);
  requests.length = 0;
  assert.equal(await repository.addComment(12, "added"), true);
  assert.equal(await repository.editComment(7, "edited"), true);
  assert.deepEqual(
    requests.map((request) => [request.method, request.url, request.body]),
    [
      ["POST", "/repos/owner/on/issues/12/comments", '{"body":"added"}'],
      ["PATCH", "/repos/owner/on/issues/comments/7", '{"body":"edited"}'],
    ],
  );
  assert.equal(await new GitHubRepositoryApi(api, "owner/off", "a-token").addComment(12, "x"), false);
});

test("commits are compared, a renamed file removing its previous path", async () => {
  const repository = new GitHubRepositoryApi(api, "owner/on", "a-token");
  assert.deepEqual(await repository.compareCommits("aaa", "bbb"), [
    { path: "features/new.feature", removed: false },
    { path: "features/old.feature", removed: true },
  ]);
});

test("commits that do not follow, a comparison that may be cut short, or none, cannot be compared", async () => {
  const repository = new GitHubRepositoryApi(api, "owner/on", "a-token");
  assert.equal(await repository.compareCommits("aaa", "ccc"), undefined);
  assert.equal(await repository.compareCommits("aaa", "ddd"), undefined);
  assert.equal(await repository.compareCommits("aaa", "eee"), undefined);
});
