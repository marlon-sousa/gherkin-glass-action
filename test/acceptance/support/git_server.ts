// Test support: a git server over HTTP on the loopback address, standing in for GitHub's, around git http-backend.

import { spawn } from "node:child_process";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

export const TOKEN = "a-token";

export class GitServer {
  private server: Server | undefined;
  address = "";
  root = "";
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

  private serve(request: IncomingMessage, response: ServerResponse): void {
    const expected = `basic ${Buffer.from(`x-access-token:${TOKEN}`).toString("base64")}`;
    if (request.headers.authorization?.toLowerCase() !== expected.toLowerCase()) {
      response.writeHead(401, { "www-authenticate": 'Basic realm="git"' }).end();
      return;
    }
    const [pathInfo = "", query = ""] = (request.url ?? "").split("?");
    if (this.refusingPushes && `${pathInfo}?${query}`.includes("git-receive-pack")) {
      response.writeHead(403).end("Permission to owner/repo.git denied to github-actions[bot].");
      return;
    }
    // git http-backend receives pushes only when REMOTE_USER is set.
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
