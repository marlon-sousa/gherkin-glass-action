// Test support: what a scenario holds, and the stand-ins for GitHub every scenario shares.

import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { After, AfterAll, Before, BeforeAll, BeforeStep, setDefaultTimeout, setWorldConstructor, World } from "@cucumber/cucumber";
import { GitServer } from "./git_server.ts";
import { SiteRepository } from "./site_repository.ts";
import { WireMock } from "./wiremock.ts";
import { runWorkflow, type WorkflowRequest, type WorkflowResult } from "./workflow_run.ts";

const wireMock = new WireMock();
const gitServer = new GitServer();
let actCache = "";

setDefaultTimeout(180_000);

BeforeAll(async () => {
  actCache = mkdtempSync(path.join(os.tmpdir(), "act-cache-"));
  await Promise.all([wireMock.start(), gitServer.start()]);
});

AfterAll(() => {
  wireMock.stop();
  gitServer.stop();
  rmSync(actCache, { recursive: true, force: true });
});

export class ScenarioWorld extends World {
  readonly files: Record<string, string> = {};
  siteRepository!: SiteRepository;
  pending: Pick<WorkflowRequest, "action" | "inputs" | "event"> | undefined;
  laterStep: string | undefined;
  private result: WorkflowResult | undefined;
  serverRoot = "";

  readonly wireMock = wireMock;
  readonly gitServer = gitServer;

  get ran(): WorkflowResult {
    if (this.result === undefined) throw new Error("No When step asked for a workflow.");
    return this.result;
  }

  async runPending(): Promise<void> {
    if (this.result !== undefined || this.pending === undefined) return;
    this.result = await runWorkflow(
      { ...this.pending, files: this.files, laterStep: this.laterStep },
      { apiAddress: wireMock.address, serverAddress: gitServer.address },
      actCache,
    );
  }

  async runBeforehand(request: Pick<WorkflowRequest, "action" | "inputs" | "event">): Promise<void> {
    const earlier = await runWorkflow(
      { ...request, files: this.files, laterStep: undefined },
      { apiAddress: wireMock.address, serverAddress: gitServer.address },
      actCache,
    );
    rmSync(earlier.workspace, { recursive: true, force: true });
    if (!earlier.actionPassed) throw new Error(`The earlier run failed:\n${earlier.printed}`);
  }

  get resultIfRun(): WorkflowResult | undefined {
    return this.result;
  }
}

setWorldConstructor(ScenarioWorld);

Before(async function (this: ScenarioWorld) {
  await wireMock.reset();
  this.serverRoot = mkdtempSync(path.join(os.tmpdir(), "git-server-"));
  gitServer.root = this.serverRoot;
  gitServer.refusingPushes = false;
  this.siteRepository = new SiteRepository(this.serverRoot);
});

BeforeStep(async function (this: ScenarioWorld, { pickleStep }) {
  if (pickleStep.type === "Outcome") await this.runPending();
});

After(function (this: ScenarioWorld, { result }) {
  const ran = this.resultIfRun;
  if (result?.status === "FAILED" && ran !== undefined) console.log(ran.printed);
  rmSync(this.serverRoot, { recursive: true, force: true });
  if (ran !== undefined) rmSync(ran.workspace, { recursive: true, force: true });
});
