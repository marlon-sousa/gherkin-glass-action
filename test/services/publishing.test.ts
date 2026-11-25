// Tests rules 20 to 22: the branch Pages serves, checked and changed, with fakes of the ports.

import assert from "node:assert/strict";
import { test } from "node:test";
import { ActionStop } from "../../src/action_stop.ts";
import { changeBranch, servedSiteOf } from "../../src/services/publishing.ts";
import { FakeRepository, PAGES, publishingPorts as ports } from "../support/publishing_fakes.ts";

const SITE = { branch: "gh-pages", folder: "features" };
const ROOT = { servedFolder: "", address: "https://owner.github.io/repo/" };

/** A change that records the checkouts it is applied to, and leaves the branch as it is when told to. */
function change(applies = true) {
  const applied: string[] = [];
  return {
    applied,
    message: "A change",
    apply: async (checkout: string) => {
      applied.push(checkout);
      return applies;
    },
  };
}

async function stops(run: () => Promise<unknown>, message: string) {
  await assert.rejects(run, (error) => error instanceof ActionStop && error.message === message);
}

test("Pages deploying from the branch gives the folder it serves and its address", async () => {
  assert.deepEqual(await servedSiteOf(SITE, ports()), { kind: "ready", ...ROOT });
});

test("Pages that does not deploy from the branch stops the action, after making the branch when it is missing", async () => {
  const off = ports([], new FakeRepository("off"));
  await stops(
    () => servedSiteOf(SITE, off),
    'Pages does not deploy from the branch gh-pages: in the repository\'s Settings, under Pages, set the source to "Deploy from a branch" and choose gh-pages.',
  );
  assert.deepEqual(off.siteBranch.steps, []);
  const missing = ports([], new FakeRepository({ ...PAGES, buildType: "workflow" }));
  missing.siteBranch.branchExists = false;
  await stops(
    () => servedSiteOf(SITE, missing),
    'The branch gh-pages is made: in the repository\'s Settings, under Pages, set the source to "Deploy from a branch" and choose gh-pages, and add an empty .nojekyll file at its root.',
  );
  assert.deepEqual(missing.siteBranch.steps, ["make"]);
  missing.siteBranch.makeAccepted = false;
  await stops(
    () => servedSiteOf(SITE, missing),
    "The site cannot be pushed to gh-pages: the workflow needs the permission contents: write.",
  );
});

test("Pages serving a folder without folder, or unreadable, stops the action", async () => {
  await stops(
    () => servedSiteOf(SITE, ports([], new FakeRepository({ ...PAGES, path: "/docs" }))),
    "Pages serves the folder /docs of gh-pages, so folder must be in it.",
  );
  const unreadable = new FakeRepository();
  unreadable.pages = undefined;
  await stops(
    () => servedSiteOf(SITE, ports([], unreadable)),
    "The settings of Pages cannot be read: the workflow needs the permission pages: read.",
  );
});

test("a change is applied to the branch's newest commit, then committed and pushed", async () => {
  const used = ports();
  const applied = change();
  assert.equal(await changeBranch("gh-pages", ROOT, applied, used), "pushed");
  assert.deepEqual(applied.applied, ["checkout-1"]);
  assert.deepEqual(used.siteBranch.steps, ["check out", "push A change"]);
});

test("a branch without .nojekyll where Pages serves stops the action before the change", async () => {
  const used = ports(["pushed"], new FakeRepository(), ["docs/.nojekyll"]);
  const applied = change();
  await stops(
    () => changeBranch("gh-pages", ROOT, applied, used),
    "Pages runs Jekyll on gh-pages, which leaves out pages whose names start with _: add an empty .nojekyll file to the folder / of gh-pages.",
  );
  assert.deepEqual(applied.applied, []);
  assert.equal(await changeBranch("gh-pages", { ...ROOT, servedFolder: "docs" }, applied, used), "pushed");
});

test("a change that leaves the branch as it is pushes nothing", async () => {
  const used = ports();
  assert.equal(await changeBranch("gh-pages", ROOT, change(false), used), "left");
  assert.deepEqual(used.siteBranch.steps, ["check out"]);
});

test("a change that changes nothing makes no commit, and says so", async () => {
  const used = ports(["unchanged"]);
  assert.equal(await changeBranch("gh-pages", ROOT, change(), used), "unchanged");
  assert.deepEqual(used.runner.logged, ["The site on gh-pages is already up to date."]);
});

test("another push first starts again from the branch's newest commit, three times in all", async () => {
  const used = ports(["behind", "pushed"]);
  const applied = change();
  await changeBranch("gh-pages", ROOT, applied, used);
  assert.deepEqual(applied.applied, ["checkout-1", "checkout-2"]);
  await stops(
    () => changeBranch("gh-pages", ROOT, change(), ports(["behind", "behind", "behind"])),
    "The site cannot be pushed to gh-pages.",
  );
  await stops(
    () => changeBranch("gh-pages", ROOT, change(), ports(["refused"])),
    "The site cannot be pushed to gh-pages: the workflow needs the permission contents: write.",
  );
});
