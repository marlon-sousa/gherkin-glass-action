// Test support: a workflow that runs one of the actions, run by act on this machine.

import { execFileSync, spawn } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { TOKEN } from "./git_server.ts";
import { ACCEPTANCE_TOOLS } from "./tools.ts";

export interface WorkflowRequest {
  readonly action: "./" | "./publish" | "./preview";
  readonly inputs: Readonly<Record<string, string>>;
  readonly event: { readonly name: "push" | "pull_request"; readonly payload: object };
  readonly files: Readonly<Record<string, string>>;
  /** In bash; undefined when there is none. */
  readonly laterStep: string | undefined;
}

export interface StandIns {
  readonly apiAddress: string;
  readonly serverAddress: string;
}

export interface Annotation {
  readonly kind: string;
  readonly file: string | undefined;
  readonly line: number | undefined;
  readonly message: string;
}

export interface WorkflowResult {
  readonly actionPassed: boolean;
  readonly log: readonly string[];
  readonly outputs: ReadonlyMap<string, string>;
  readonly annotations: readonly Annotation[];
  readonly workspace: string;
  readonly printed: string;
}

const ACTION_FILES = ["action.yml", "dist", "publish", "preview"];

/** Must not block, since the git server the job pushes to answers in this same process. */
export async function runWorkflow(request: WorkflowRequest, standIns: StandIns, actCache: string): Promise<WorkflowResult> {
  const repository = mkdtempSync(path.join(os.tmpdir(), "repository-"));
  const workspace = mkdtempSync(path.join(os.tmpdir(), "workspace-"));
  try {
    writeRepository(repository, request);
    const printed = await actPrints(repository, request.event.name, [
      ["--env", `GITHUB_SERVER_URL=${standIns.serverAddress}`],
      ["--env", `GITHUB_API_URL=${standIns.apiAddress}`],
      ["--env", `ACCEPTANCE_WORKSPACE_COPY=${workspace}`],
      ["-s", `GITHUB_TOKEN=${TOKEN}`],
      // nektos/act v0.2.97 keeps each job's folder and the runner's tool cache there, rather than in ~/.cache/act.
      ["--action-cache-path", actCache],
    ].flat());
    return { ...resultOf(printed), workspace };
  } catch (error) {
    rmSync(workspace, { recursive: true, force: true });
    throw error;
  } finally {
    rmSync(repository, { recursive: true, force: true });
  }
}

function writeRepository(repository: string, request: WorkflowRequest): void {
  execFileSync("git", ["init", "--quiet", "-b", "main", repository]);
  for (const file of ACTION_FILES) cpSync(file, path.join(repository, file), { recursive: true });
  for (const [file, text] of Object.entries(request.files)) {
    mkdirSync(path.dirname(path.join(repository, file)), { recursive: true });
    writeFileSync(path.join(repository, file), text);
  }
  mkdirSync(path.join(repository, ".github", "workflows"), { recursive: true });
  writeFileSync(path.join(repository, ".github", "workflows", "acceptance.yml"), workflowOf(request));
  writeFileSync(path.join(repository, "event.json"), JSON.stringify(request.event.payload));
  // act names the repository from the remote origin.
  execFileSync("git", ["-C", repository, "remote", "add", "origin", "https://github.com/owner/repo.git"]);
  const author = ["-c", "user.name=Someone", "-c", "user.email=someone@example.com"];
  execFileSync("git", ["-C", repository, "add", "--all"]);
  execFileSync("git", ["-C", repository, ...author, "commit", "--quiet", "-m", "The repository of the scenario"]);
}

// Decoded whole, so that a character split between two chunks stays one.
async function actPrints(repository: string, event: string, options: string[]): Promise<string> {
  const act = spawn(
    ACCEPTANCE_TOOLS.act,
    [event, "-W", path.join(".github", "workflows", "acceptance.yml"), "-e", "event.json", "-P", "ubuntu-latest=-self-hosted", ...options],
    // Without it, nektos/act v0.2.97 asks api.nektosact.com for notices on every run.
    { cwd: repository, env: { ...process.env, ACT_DISABLE_VERSION_CHECK: "1" } },
  );
  act.stdout.setEncoding("utf8");
  act.stderr.setEncoding("utf8");
  let printed = "";
  act.stdout.on("data", (text: string) => (printed += text));
  act.stderr.on("data", (text: string) => (printed += text));
  await new Promise((resolve, reject) => {
    act.on("error", reject);
    act.on("close", resolve);
  });
  return printed;
}

function workflowOf(request: WorkflowRequest): string {
  const inputs = Object.entries(request.inputs).map(([name, value]) => `          ${name}: ${JSON.stringify(value)}`);
  return [
    "on: [push, pull_request]",
    "jobs:",
    "  acceptance:",
    "    runs-on: ubuntu-latest",
    "    steps:",
    // nektos/act v0.2.97 copies the repository it runs in for actions/checkout, and fetches nothing.
    "      - uses: actions/checkout@v4",
    "      - id: action",
    `        uses: ${request.action}`,
    // nektos/act v0.2.97 gives RUNNER_ARCH arm64, not ARM64, on a 64-bit ARM machine, and a step's env wins over it.
    "        env:",
    `          RUNNER_ARCH: ${process.arch === "arm64" ? "ARM64" : "X64"}`,
    ...(inputs.length > 0 ? ["        with:", ...inputs] : []),
    ...(request.laterStep === undefined
      ? []
      : ["      - shell: bash", `        run: ${JSON.stringify(request.laterStep)}`]),
    // nektos/act v0.2.97 removes the folder it runs the job in.
    "      - if: always()",
    "        shell: bash",
    '        run: cp -R . "$ACCEPTANCE_WORKSPACE_COPY"',
    "",
  ].join("\n");
}

// nektos/act v0.2.97 prints each line as [<workflow>/<job>] <line>: | before a step's output, ❗ before an annotation, ⚙ before an output, and Success or Failure for each step.
function resultOf(printed: string): Omit<WorkflowResult, "workspace"> {
  const log: string[] = [];
  const outputs = new Map<string, string>();
  const annotations: Annotation[] = [];
  let actionPassed = false;
  for (const whole of printed.split(/\r?\n/)) {
    const line = whole.replace(/^\[[^\]]*\]\s*/, "");
    const logged = /^\| ?(.*)$/.exec(line);
    if (logged) log.push(logged[1] ?? "");
    const output = /::set-output:: ([^=]+)=(.*)$/.exec(line);
    if (output) outputs.set(output[1] ?? "", output[2] ?? "");
    const annotation = /::(error|warning|notice)(?: ([^:]*))?::(.*)$/.exec(line);
    if (annotation && !line.startsWith("|")) annotations.push(annotationOf(annotation[1] ?? "", annotation[2] ?? "", annotation[3] ?? ""));
    if (/^✅\s+Success - Main \.\/?(publish|preview)?$/.test(line.replace(/\s*\[[^\]]*\]$/, ""))) actionPassed = true;
  }
  return { actionPassed, log, outputs, annotations, printed };
}

function annotationOf(kind: string, properties: string, message: string): Annotation {
  const property = (name: string) => new RegExp(`(?:^|,)${name}=([^,]*)`).exec(properties)?.[1];
  const line = property("line");
  return { kind, file: property("file"), line: line === undefined ? undefined : Number(line), message };
}
