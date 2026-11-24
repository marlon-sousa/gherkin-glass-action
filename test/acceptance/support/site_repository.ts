// Test support: the repository owner/repo the git server serves, whose branch Pages serves.

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export class SiteRepository {
  /** The bare repository, owner/repo.git under the git server's folder. */
  readonly bare: string;

  constructor(serverRoot: string) {
    this.bare = path.join(serverRoot, "owner", "repo.git");
    mkdirSync(this.bare, { recursive: true });
    execFileSync("git", ["init", "--quiet", "--bare", this.bare]);
  }

  /** Makes the branch hold those files, and nothing else, in one commit. */
  giveBranch(branch: string, files: Readonly<Record<string, string>>): void {
    const work = mkdtempSync(path.join(os.tmpdir(), "branch-"));
    try {
      execFileSync("git", ["init", "--quiet", "-b", branch, work]);
      for (const [file, text] of Object.entries(files)) {
        mkdirSync(path.dirname(path.join(work, file)), { recursive: true });
        writeFileSync(path.join(work, file), text);
      }
      const author = ["-c", "user.name=Someone", "-c", "user.email=someone@example.com"];
      execFileSync("git", ["-C", work, "add", "--all"]);
      execFileSync("git", ["-C", work, ...author, "commit", "--quiet", "--allow-empty", "-m", "Set up the branch"]);
      // A push.negotiate set in the machine's own git configuration fails against a bare folder.
      execFileSync("git", ["-C", work, "-c", "push.negotiate=false", "push", "--quiet", this.bare, `${branch}:${branch}`]);
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  }

  /** Whether the branch exists. */
  hasBranch(branch: string): boolean {
    return this.git("branch", "--list", branch) !== "";
  }

  /** The files the branch holds, with / between folders. */
  filesOf(branch: string): readonly string[] {
    const listed = this.git("ls-tree", "-r", "--name-only", branch);
    return listed === "" ? [] : listed.split("\n");
  }

  /** The text of a file the branch holds, its path written with /. */
  textOf(branch: string, file: string): string {
    return this.git("show", `${branch}:${file}`);
  }

  /** The subject of the branch's newest commit. */
  lastSubjectOf(branch: string): string {
    return this.git("log", "-1", "--format=%s", branch);
  }

  /** How many commits the branch has. */
  commitsOf(branch: string): number {
    return Number(this.git("rev-list", "--count", branch));
  }

  private git(...gitArguments: string[]): string {
    return execFileSync("git", ["--git-dir", this.bare, ...gitArguments], { encoding: "utf8" }).trim();
  }
}
