// Test support: a git server over HTTP on the loopback address, standing in for GitHub's, around
// git http-backend, which serves the repositories under one folder (git-http-backend, "DESCRIPTION").

import { spawn } from "node:child_process";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

/** The token the workflows push with, as GitHub's own token would be. */
export const TOKEN = "a-token";

export class GitServer {
  private server: Server | undefined;
  /** Such as http://127.0.0.1:51235, which the actions are given as GITHUB_SERVER_URL. */
  address = "";
  /** The folder of the repositories, such as <root>/owner/repo.git. */
  root = "";
  /** Whether pushes are refused, as they are to a token without the permission contents: write. */
  refusingPushes = false;

  async start(): Promise<void> {
    const server = createServer((request, response) => this.serve(request, response));
    this.server = server;
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const listening = server.address();
    if (typeof listening !== "object" || listening === null) throw new Error("The git server has no port.");
    this.address = `http://127.0.0.1:${listening.port}`;
  }

  stop(): void {
    this.server?.close();
  }

  // Only the token the action is given is let in, to fetch and to push, sent as GitHub expects it:
  // basic, with the user x-access-token, as src/adapters/git_site_branch.ts sends it.
  private serve(request: IncomingMessage, response: ServerResponse): void {
    const expected = `basic ${Buffer.from(`x-access-token:${TOKEN}`).toString("base64")}`;
    if (request.headers.authorization?.toLowerCase() !== expected.toLowerCase()) {
      response.writeHead(401, { "www-authenticate": 'Basic realm="git"' }).end();
      return;
    }
    const [pathInfo = "", query = ""] = (request.url ?? "").split("?");
    // GitHub answers 403 to a push with a token that may only read.
    if (this.refusingPushes && `${pathInfo}?${query}`.includes("git-receive-pack")) {
      response.writeHead(403).end("Permission to owner/repo.git denied to github-actions[bot].");
      return;
    }
    // git-http-backend, "ENVIRONMENT": REMOTE_USER lets it receive pushes.
    const backend = spawn("git", ["http-backend"], {
      env: {
        ...process.env,
        GIT_PROJECT_ROOT: this.root,
        GIT_HTTP_EXPORT_ALL: "1",
        PATH_INFO: pathInfo,
        QUERY_STRING: query,
        REQUEST_METHOD: request.method ?? "GET",
        CONTENT_TYPE: request.headers["content-type"] ?? "",
        HTTP_CONTENT_ENCODING: String(request.headers["content-encoding"] ?? ""),
        GIT_PROTOCOL: String(request.headers["git-protocol"] ?? ""),
        REMOTE_USER: "x-access-token",
        REMOTE_ADDR: "127.0.0.1",
      },
    });
    request.pipe(backend.stdin);
    let head = Buffer.alloc(0);
    let headersSent = false;
    backend.stdout.on("data", (chunk: Buffer) => {
      if (headersSent) {
        response.write(chunk);
        return;
      }
      head = Buffer.concat([head, chunk]);
      const end = head.indexOf("\r\n\r\n");
      if (end === -1) return;
      headersSent = true;
      // CGI headers: a Status line, when not 200, and the response's own headers.
      let status = 200;
      for (const line of head.subarray(0, end).toString("latin1").split("\r\n")) {
        const [name = "", ...value] = line.split(":");
        if (name.toLowerCase() === "status") status = Number.parseInt(value.join(":").trim(), 10);
        else response.setHeader(name, value.join(":").trim());
      }
      response.writeHead(status);
      response.write(head.subarray(end + 4));
    });
    backend.on("close", () => response.end());
  }
}
