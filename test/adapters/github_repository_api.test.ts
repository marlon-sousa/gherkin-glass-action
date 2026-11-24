// Tests docs/BEHAVIOUR.md, rules 20, 27 to 29: the repository through GitHub's API, served on the loopback address.

import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import { getOctokit } from "@actions/github";
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
      const reply = (status: number, value?: unknown, link?: string) => {
        response.statusCode = status;
        response.setHeader("content-type", "application/json");
        if (link !== undefined) response.setHeader("link", link);
        response.end(value === undefined ? "" : JSON.stringify(value));
      };
      if (url.pathname === "/repos/owner/on/pages") {
        reply(200, { html_url: "https://owner.github.io/on/", build_type: "legacy", source: { branch: "gh-pages", path: "/" } });
      } else if (url.pathname === "/repos/owner/off/pages") reply(404, { message: "Not Found" });
      else if (url.pathname === "/repos/owner/forbidden/pages") reply(403, { message: "Resource not accessible by integration" });
      else if (url.pathname === "/repos/owner/on/pulls/12/files") {
        // The link header names the next page, which Octokit's paginate follows, as GitHub's API does.
        const page = Number(url.searchParams.get("page") ?? "1");
        const next = page === 1 ? `<${api}/repos/owner/on/pulls/12/files?per_page=100&page=2>; rel="next"` : undefined;
        reply(200, FILES.slice((page - 1) * 100, page * 100), next);
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

// Node's own fetch, rather than the runner's proxy that @actions/github would set up, reaches the
// loopback address wherever the tests run.
function repositoryOf(repository: string): GitHubRepositoryApi {
  return new GitHubRepositoryApi(getOctokit("a-token", { baseUrl: api, request: { fetch } }), repository);
}

test("Pages' settings are read with the token, and Pages that is off or unreadable told apart", async () => {
  requests.length = 0;
  assert.deepEqual(await repositoryOf("owner/on").pagesSettings(), {
    buildType: "legacy",
    branch: "gh-pages",
    path: "/",
    address: "https://owner.github.io/on/",
  });
  assert.equal(requests[0]?.authorization, "token a-token");
  assert.equal(await repositoryOf("owner/off").pagesSettings(), "off");
  assert.equal(await repositoryOf("owner/forbidden").pagesSettings(), undefined);
});

test("every page of a pull request's files is listed, the removed ones told apart", async () => {
  const files = await repositoryOf("owner/on").listChangedFiles(12);
  assert.equal(files?.length, 150);
  assert.deepEqual(files?.[0], { path: "features/0.feature", removed: true });
  assert.deepEqual(files?.[149], { path: "features/149.feature", removed: false });
  assert.equal(await repositoryOf("owner/off").listChangedFiles(12), undefined);
});

test("comments are listed, added and edited", async () => {
  const repository = repositoryOf("owner/on");
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
  assert.equal(await repositoryOf("owner/off").addComment(12, "x"), false);
});

test("commits are compared, a renamed file removing its previous path", async () => {
  const repository = repositoryOf("owner/on");
  assert.deepEqual(await repository.compareCommits("aaa", "bbb"), [
    { path: "features/new.feature", removed: false },
    { path: "features/old.feature", removed: true },
  ]);
});

test("commits that do not follow, a comparison that may be cut short, or none, cannot be compared", async () => {
  const repository = repositoryOf("owner/on");
  assert.equal(await repository.compareCommits("aaa", "ccc"), undefined);
  assert.equal(await repository.compareCommits("aaa", "ddd"), undefined);
  assert.equal(await repository.compareCommits("aaa", "eee"), undefined);
});
