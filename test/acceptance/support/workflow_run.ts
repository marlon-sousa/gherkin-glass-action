// Test support: a workflow that runs one of the actions, run by act on this machine, as issue #16 agreed.

import { execFileSync, spawn } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { TOKEN } from "./git_server.ts";
import { ACCEPTANCE_TOOLS } from "./tools.ts";

/** What a scenario runs: which action, with which inputs, on which event, in a repository holding which files. */
export interface WorkflowRequest {
  readonly action: "./" | "./publish" | "./preview";
  readonly inputs: Readonly<Record<string, string>>;
  readonly event: { readonly name: "push" | "pull_request"; readonly payload: object };
  readonly files: Readonly<Record<string, string>>;
  /** A command a later step of the job runs, in bash, if any. */
  readonly laterStep: string | undefined;
}

/** Where the stand-ins for GitHub listen. */
export interface StandIns {
  readonly apiAddress: string;
  readonly serverAddress: string;
}

/** An annotation the action wrote: an error or a notice, on a file and a line or on none. */
export interface Annotation {
  readonly kind: string;
  readonly file: string | undefined;
  readonly line: number | undefined;
  readonly message: string;
}

/** What the run showed: whether the action's step passed, its log, its outputs and its annotations. */
export interface WorkflowResult {
  readonly actionPassed: boolean;
  readonly log: readonly string[];
  readonly outputs: ReadonlyMap<string, string>;
  readonly annotations: readonly Annotation[];
  /** A copy of the workspace as the job left it, the repository the workflow checked out. */
  readonly workspace: string;
  /** All act printed, for a scenario that fails. */
  readonly printed: string;
}

// The files of the actions, copied from this repository, as a workflow of another repository
// would get them: the action.yml files and the bundles they name.
const ACTION_FILES = ["action.yml", "dist", "publish", "preview"];

/**
 * Runs the workflow with act, the job on this machine itself (act's -P <label>=-self-hosted). It
 * waits without blocking, since the git server the job pushes to answers in this same process.
 */
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
      // act keeps each job's folder, and the runner's tool cache, there, rather than in ~/.cache/act
      // (nektos/act v0.2.97, cmd/root.go, line 127), so that each run starts clean and leaves nothing.
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

// The repository the workflow runs in: the actions, the scenario's files, the workflow and its event.
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
  // act names the repository from the remote origin: owner/repo, which the stand-ins serve.
  execFileSync("git", ["-C", repository, "remote", "add", "origin", "https://github.com/owner/repo.git"]);
  const author = ["-c", "user.name=Someone", "-c", "user.email=someone@example.com"];
  execFileSync("git", ["-C", repository, "add", "--all"]);
  execFileSync("git", ["-C", repository, ...author, "commit", "--quiet", "-m", "The repository of the scenario"]);
}

// All act prints running the workflow on the machine itself, decoded whole, so that a character
// split between two chunks stays one.
async function actPrints(repository: string, event: string, options: string[]): Promise<string> {
  const act = spawn(
    ACCEPTANCE_TOOLS.act,
    [event, "-W", path.join(".github", "workflows", "acceptance.yml"), "-e", "event.json", "-P", "ubuntu-latest=-self-hosted", ...options],
    // Without it, act asks api.nektosact.com for notices on every run (nektos/act v0.2.97, cmd/notices.go, lines 63 to 68).
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
    // act copies the repository it runs in for actions/checkout, and fetches nothing for it
    // (nektos/act v0.2.97, pkg/runner/step_action_remote.go, lines 55 to 58 and 186 to 194).
    "      - uses: actions/checkout@v4",
    "      - id: action",
    `        uses: ${request.action}`,
    // act gives RUNNER_ARCH arm64, not ARM64, on a 64-bit ARM machine, since its map lacks Go's arm64 (nektos/act
    // v0.2.97, pkg/container/host_environment.go, lines 438 to 449), and its value comes before the
    // machine's own (pkg/runner/run_context.go, lines 230 to 242); a step's env comes last
    // (pkg/runner/step.go, lines 270 to 272).
    "        env:",
    `          RUNNER_ARCH: ${process.arch === "arm64" ? "ARM64" : "X64"}`,
    ...(inputs.length > 0 ? ["        with:", ...inputs] : []),
    ...(request.laterStep === undefined
      ? []
      : ["      - shell: bash", `        run: ${JSON.stringify(request.laterStep)}`]),
    // act runs the job in a folder of its own, which it removes (nektos/act v0.2.97,
    // pkg/container/host_environment.go, lines 392 to 398): the scenario reads a copy.
    "      - if: always()",
    "        shell: bash",
    '        run: cp -R . "$ACCEPTANCE_WORKSPACE_COPY"',
    "",
  ].join("\n");
}

// act prints each line of the job as [<workflow>/<job>] <line>: | before a line of a step's
// output, ❗ before an annotation, ⚙ before an output, and Success or Failure for each step.
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
