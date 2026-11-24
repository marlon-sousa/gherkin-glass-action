// Test support: WireMock, standing in for GitHub's API on the loopback address, as issue #16 agreed.

import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { freePort, waitUntil } from "./loopback.ts";
import { ACCEPTANCE_TOOLS } from "./tools.ts";

/** A request WireMock received: its method, its address without the server, and its body. */
export interface ReceivedRequest {
  readonly method: string;
  readonly url: string;
  readonly body: string;
}

export class WireMock {
  private process: ChildProcess | undefined;
  private rootFolder: string | undefined;
  /** Such as http://127.0.0.1:51234, which the actions are given as GITHUB_API_URL. */
  address = "";

  async start(): Promise<void> {
    const port = await freePort();
    this.address = `http://127.0.0.1:${port}`;
    const javaHome = process.env["JAVA_HOME"];
    const java = javaHome ? path.join(javaHome, "bin", "java") : "java";
    // WireMock makes the folders mappings and __files in its root, the current folder unless
    // --root-dir names another (WireMock 3.13.2, java -jar wiremock.jar --help), so a folder of
    // its own keeps them out of the repository.
    const rootFolder = mkdtempSync(path.join(tmpdir(), "wiremock-"));
    this.rootFolder = rootFolder;
    const started = spawn(
      java,
      [
        "-jar",
        ACCEPTANCE_TOOLS.wiremock,
        "--port",
        String(port),
        "--bind-address",
        "127.0.0.1",
        "--root-dir",
        rootFolder,
        "--disable-banner",
      ],
      { stdio: "ignore" },
    );
    this.process = started;
    const failed = new Promise<never>((_, reject) =>
      started.once("error", (error) => reject(new Error(`WireMock cannot start, which needs Java 11 or newer: ${error.message}`))),
    );
    await Promise.race([failed, waitUntil(async () => (await fetch(`${this.address}/__admin/health`).catch(() => undefined))?.ok === true)]);
  }

  stop(): void {
    this.process?.kill();
    // Windows may hold the folder a moment after Java is killed; Node retries on EBUSY and EPERM
    // (Node's documentation, "fs.rmSync").
    if (this.rootFolder !== undefined) rmSync(this.rootFolder, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }

  /** Forgets every answer and request of the scenario before. */
  async reset(): Promise<void> {
    await this.admin("POST", "/__admin/reset");
  }

  /** Forgets the requests received so far, keeping the answers. */
  async forgetRequests(): Promise<void> {
    await this.admin("DELETE", "/__admin/requests");
  }

  /**
   * Answers a method and a path of the repository owner/repo, whatever the query, with a status and
   * a JSON body. The newest answer to a request wins (WireMock, "Stubbing", "Stub priority").
   */
  async answer(method: string, repositoryPath: string, status: number, body?: unknown): Promise<void> {
    await this.admin("POST", "/__admin/mappings", {
      request: { method, urlPath: `/repos/owner/repo${repositoryPath}` },
      response: {
        status,
        headers: { "content-type": "application/json" },
        ...(body === undefined ? {} : { jsonBody: body }),
      },
    });
  }

  /** The requests received, oldest first. */
  async requests(): Promise<readonly ReceivedRequest[]> {
    const listed: { requests: { request: ReceivedRequest }[] } = await this.admin("GET", "/__admin/requests");
    return listed.requests.map(({ request }) => ({ method: request.method, url: request.url, body: request.body })).reverse();
  }

  private async admin<T>(method: string, adminPath: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.address}${adminPath}`, {
      method,
      ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { "content-type": "application/json" } }),
    });
    if (!response.ok) throw new Error(`WireMock answered ${response.status} to ${method} ${adminPath}`);
    const text = await response.text();
    return (text === "" ? undefined : JSON.parse(text)) as T;
  }
}
