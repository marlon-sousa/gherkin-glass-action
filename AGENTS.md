# AGENTS.md: working in gherkin-glass-action

The manual for anyone, human or agent, changing gherkin-glass-action. [CONTRIBUTING.md](CONTRIBUTING.md) describes the process; this file says how to follow it.

## What to read

- [docs/BEHAVIOUR.md](docs/BEHAVIOUR.md): what the action promises. Code does what it says, no more and no less.
- "How the code is organised" below, before writing any.
- [.claude/skills/](.claude/skills/): the procedures for reviewing a change, writing a commit and following a stack. Claude Code loads them on its own; another agent reads the one it needs.
- The issue the work belongs to. Once it is agreed, its body holds every decision and binds the work; its comments are only the history of how they were reached. While it is still being agreed, read its comments too.
- For what `ghg` itself does, gherkin-glass's [docs/BEHAVIOUR.md](https://github.com/marlon-sousa/gherkin-glass/blob/main/docs/BEHAVIOUR.md), whose rule numbers this repository names as "gherkin-glass's rule N".

## Rules

1. **No code before its behaviour.** Work on a feature starts only once its issue is agreed and its behaviour is in docs/BEHAVIOUR.md. If the behaviour is missing, or the code would need to do something the document does not say, stop and raise it in the issue.
2. **Every rule has a test.** A rule added to or changed in docs/BEHAVIOUR.md comes with a test that checks it, named in the rule, in the same pull request as the code that makes it pass.
3. **Inputs are promises.** Never remove or rename an input, or change the message the action stops with, without a major version, agreed in an issue.
4. **The bundles are the actions.** The runner runs `dist/index.cjs`, `dist/publish/index.cjs` and `dist/preview/index.cjs` as they are in the repository, so every change to `src/`, `paired-ghg.json`, which they bundle, `package.json` or `package-lock.json` is committed with `dist/` built again from it: the bundles, and `dist/licenses.txt`, the licences of the packages they hold.
5. **Small pull requests.** One thing each, naming its issue with `Closes #N` or `Refs #N`, with commit messages as CONTRIBUTING.md describes. Work too large for one is a stack, declared to GitHub through the REST API as CONTRIBUTING.md, "Stacked pull requests", describes, without installing `gh stack`.
6. **Write for a screen reader.** Issues, pull requests, comments and documents use headings, lists, prose and simple tables, never ASCII art.
7. **Mark agent comments.** A comment an agent writes on GitHub says it is an agent's.
8. **Check a library before ruling it in or out.** Before saying that a package or an action can or cannot do something, read its source or its documentation at the version we would use. Look for its override and extension points, not only its defaults. The issue or pull request says what was checked: the file and line, or the documentation page.
9. **One question at a time.** A question for the maintainer is asked in plain prose, one decision at a time, with the option recommended and why. The answer is recorded on its issue, as CONTRIBUTING.md, "Issues come first", describes, before the next question is asked.
10. **Reuse before writing.** Before writing code that does something general, such as calling GitHub's API, downloading, running a process or reading the runner's settings, look for what already does it, in this order: the code of this repository; the official packages of the Actions toolkit, `@actions/*`, such as `@actions/github` for GitHub's API; then a maintained package. Write it yourself only when none fits, and the issue or the pull request says what was considered and why it does not fit, with the source that shows it, as rule 8 asks.

## How the code is organised

The repository holds three actions: the root action, in `action.yml`, which installs `ghg` and builds a site, and the publish and preview actions, in `publish/action.yml` and `preview/action.yml`, which publish it on GitHub Pages. They are TypeScript, in `src/`, each bundled with its dependencies by esbuild into one file, `dist/index.cjs`, `dist/publish/index.cjs` and `dist/preview/index.cjs`, which its `action.yml` names and the runner runs on its own Node. It is organised in the roles of gherkin-glass's page script, each file declaring its role in a comment on its first line:

- **`src/policies/`**: the decisions, as pure functions of their arguments and the constants they hold, which read nothing and write nothing: which target a runner gets, which release a version names, the checksum a file lists for an archive, the arguments of `ghg build`, how it ended, from the report it prints, and the annotation each of its problems becomes, and, for publishing, what the workflow's event asks for, whether Pages is ready, the title and the comment of a preview and the changed files it shows.
- **`src/ports/`**: the interfaces through which a service reaches the world: the runner, the releases of `ghg`, the runner's tool cache, its files, the process of `ghg build`, the repository on GitHub's API, and the branch Pages serves.
- **`src/adapters/`**: the ports' implementations, the only files that import `@actions/*` packages or a module of Node's that reaches the system, such as `node:fs`, `node:http` or `node:child_process`. `node:path` only computes, and any role may use it.
- **`src/services/`**: the action's steps, reading the inputs, installing, building and publishing, and the service that runs them in order, each calling policies and ports, never an adapter.
- **`src/action_stop.ts`**: `ActionStop`, the error a service throws when the action cannot go on, with the sentence a person reads, and `orStop`, which turns a policy's problem into one.
- **`src/main.ts`**, **`src/publish_main.ts`** and **`src/preview_main.ts`**: the composition roots of the three actions, which make the adapters and run the services; the last two share theirs, `src/site_action_ports.ts`.
- **`tools/`**: scripts the checks run, which are not part of the action, such as `tools/bundle.ts`, which bundles the three actions and writes the licences of the packages they hold, and `tools/check_inputs.ts`, which compares the inputs with the options of `ghg build`, and `tools/acceptance_tools.ts`, which downloads the programs the acceptance tests run. Node runs them as TypeScript, as it is.
- **`features/`** and **`test/acceptance/`**: the acceptance tests, the scenarios in Gherkin, and their steps and the stand-ins for GitHub they start, which are not part of the action either.

These hold the code to that shape:

1. **One thing per file.** A file holds one policy, port, adapter or service. As a guide for judgement, not a gate, a source file is under 200 lines and a test file under 150; past that, the reviewer says whether it still holds one thing well.
2. **Names say what they are.** `releases.listTags()`, never `list()`; `buildArguments`, never `args`.
3. **Tests mirror the sources.** A test of `src/policies/targets.ts` is `test/policies/targets.test.ts`. A service is tested with fakes of its ports, in `test/support/`. An adapter that downloads is tested against a server on the loopback address, which the test starts and stops, never against the network. The acceptance tests are the one exception: their scenarios download the real `ghg` from github.com.
4. **Messages are the specification's.** Every sentence the action stops with or reports is the one docs/BEHAVIOUR.md gives, word for word, and a test checks it.
5. **Errors are values until the root.** A policy returns what failed; a service throws an `ActionStop` with the sentence a person reads; only `src/main.ts` turns it into the step's failure.
6. **No escape hatches.** No `any`, no `as` casts and no non-null assertions, `!`, outside tests; a value that may be missing is checked.
7. **Comments say only what the code cannot.** "Comments" below says which.

The dependencies are pinned to exact versions in `package.json`, and installed with `npm ci` from the committed lockfile.

## Comments

A comment says only what the code cannot:

- the module's role line;
- a measured fact, with what it was measured against, such as "Chromium, through Playwright 1.63.0, fails a `fetch` from a `file://` page";
- an invariant or a hazard the code does not enforce itself;
- what an absent value, an error or a rejection carries.

One sentence, where it applies, once. Why a decision was taken, what else was considered and what came before belong in the issue and the pull request, which keep them, not in the code. A field, a function or a test whose name already says what it is gets no doc comment.

Four more rules apply to every comment:

- A measured fact names the program and its version, never a date.
- A fact appears once in the repository. A second document that needs it says "see" with a path, and code that needs it relies on it without repeating it.
- No `TODO` comments, and no bold.
- Code never cites an issue, a pull request or a document, with one exception: a test cites the rule of docs/BEHAVIOUR.md it checks by its number, such as `// Rule 110: the parts are the step's text.`, so that each rule leads to its test.

## Reviewing a change

Every pull request is reviewed by an independent reviewer before it is opened, one given the change, not its author's reasoning. A later push to an open pull request is made once the checks under "Building and testing" pass, and is reviewed while its CI runs; an accepted finding becomes a further push, reviewed the same way. An agent's `.claude/skills/review-change` says how to start and resume the reviewer. The reviewer is given this section in full, the documents under "What to read", the issue, the commits to review and the draft pull request description. For each item, it lists every place in the diff where the item applies, not only the first, and checks each against the rule it names.

1. Every behaviour the change adds, against docs/BEHAVIOUR.md, and every rule added or changed there, against rule 2 above: the test the rule names exists and checks it, and so do the scenarios of `features/` it names, each tagged with its rule. A rule a workflow can observe has scenarios.
2. Every input the change adds, changes or removes, against rule 3 above, and against its `action.yml`, the README's table of that action's inputs, and, for an option of `ghg build`, the options of the paired `ghg`: all say the same.
3. Every sentence the action stops with or reports, against docs/BEHAVIOUR.md, word for word, and against "How the code is organised", rule 4.
4. Every file the change adds or makes longer, against "How the code is organised": its role, its folder, its name, and its length against rule 1 there.
5. Every test the change adds or moves, against "How the code is organised", rule 3: where it is, and that it reaches no network.
6. Every comment, against "Comments".
7. Every `any`, cast, non-null assertion, `throw` and `catch`, against "How the code is organised", rules 5 and 6; every helper, naming what already provides it, if anything, in this repository or in a package; and every line that changes nothing.
8. Every piece of code that does something general, against rule 10 above: what already does it, in this repository, in an official `@actions/*` package or in a maintained package, and, when none is used, that the change says why, with its source.
9. Every service and adapter, against the roles: a service that imports an adapter or an `@actions/*` package, and a policy that reads or writes anything, are findings.
10. `dist/`, against rule 4 above: rebuilt from the change and committed with it.
11. Every dependency the change adds or raises, against rule 8 above, and that it is pinned to an exact version; every action a workflow uses, that it is pinned to a commit with its version in a comment.
12. Every workflow the change adds or changes: its permissions are the fewest it needs, and no value a person can write, such as a pull request's description or an input, is written into a script rather than passed in the environment.
13. The commit messages and the description, against CONTRIBUTING.md and rule 5 above. For a layer of a stack, its branch sits on the current tip of the layer below and holds no merge of a lower branch, as CONTRIBUTING.md, "Stacked pull requests", rule 5, says.
14. Every claim that a library or an action can or cannot do something, against rule 8 above: it names the source it was checked against.
15. README.md and CONTRIBUTING.md: what they say is still true after the change, for a person writing a workflow and for a contributor.
16. The checks under "Building and testing", run at the reviewed revision, without changing the checkout the author works in.

The report lists findings, each marked blocking or not, with its `file:line` and a fix, then a verdict: approve, or changes needed. A finding the author rejects goes back to the reviewer with the reason, and a blocking one closes only when the reviewer agrees or the maintainer decides. A pull request is reported ready to the maintainer only once both the review and the CI of its latest push have passed.

## Building and testing

Node is pinned in `.node-version`, to the major version the runner runs the action on. From the repository's root, `npm ci` installs the dependencies from the lockfile. Before pushing, run the checks a pull request runs:

- `npm run typecheck`, the TypeScript type-checked with `tsc --noEmit`;
- `npm test`, the unit tests, with `node --test`;
- `npm run check-dist`, which bundles the action again and fails when `dist/` differs from the committed one;
- `npm run acceptance`, the scenarios of `features/`, below;
- the release tools' own tests, `.github/release/test-gate.sh`, `.github/release/test-action-tag.sh` and `.github/release/test-publish.sh`, and `.github/release/test-notes.sh`, which needs git-cliff 2.14.2.

`npm run acceptance` runs the scenarios of `features/` with cucumber-js, the steps in `test/acceptance/`. Each scenario writes a workflow that uses `./`, `./publish` or `./preview`, from the committed `dist/`, so bundle first, and runs it with [act](https://github.com/nektos/act) on the machine itself, without Docker, against two stand-ins for GitHub on the loopback address: [WireMock](https://wiremock.org/) for its API, and a server around `git http-backend` for the repository whose branch Pages serves. They download the real `ghg` from github.com. They need git, whose own `git http-backend` they run (git's documentation, [git-http-backend](https://git-scm.com/docs/git-http-backend)), and Java 11 or newer, which WireMock 3 needs (wiremock.org, [Download and Installation](https://wiremock.org/docs/download-and-installation/)). The command first runs `tools/acceptance_tools.ts`, which downloads act and WireMock's jar, at the versions it pins, checked against their checksums, into `.acceptance/`, once. A scenario that fails prints all act printed.

`npm run bundle` writes `dist/` from the sources: the three bundles, and `dist/licenses.txt`, with the name, version and licence of each package esbuild bundles, its licence files, the notices of code it embeds without one, which `tools/licenses/` keeps, and the notices in the bundled code's comments; commit it with them. The two folders `publish/` and `preview/` hold only their `action.yml`. The checks that run the action itself, on each platform, run only on GitHub, in `.github/workflows/action.yml`.

The commit messages can be checked before pushing with the `commit-messages` action of [itinera-dev/actions](https://github.com/itinera-dev/actions), which needs Python 3.11 or later. With a clone of it in the shell variable `ACTIONS`, run `PYTHONPATH="$ACTIONS" python3 "$ACTIONS/commit-messages/main.py" origin/main..HEAD` in this repository.
