# Contributing to gherkin-glass-action

Thank you for your interest. This guide describes how the gherkin-glass GitHub Action is planned, built and released. The action installs `ghg`, the command of [gherkin-glass](https://github.com/marlon-sousa/gherkin-glass), on a runner, builds a site with it when asked, and, with its publish and preview actions, publishes that site on GitHub Pages. Changes to `ghg` itself belong to gherkin-glass, which has a guide of its own.

## How gherkin-glass-action is built

AI is an integral part of how gherkin-glass-action is made. Agents write code and documentation, review pull requests, and evaluate and manage issues. A human maintainer reviews everything before it is merged. The review asks whether the work is right: whether it does what [docs/BEHAVIOUR.md](docs/BEHAVIOUR.md) says, whether it is safe to change, and whether the next person can read it. Work that is right is used, whoever or whatever produced it. Work that is not right is not merged.

These are the terms of [A manifesto for software engineering with AI](https://marlon-sousa.com/blog/manifesto/). By opening an issue or a pull request, you accept them: you may write your contribution with AI or without it, you have read what you submit and answer for it, and agents may read, evaluate and comment on your issues and pull requests, always marked as an agent's comment.

## Issues come first

Every change starts as an issue, and is agreed in the issue before any code is written. The expensive mistake is building the wrong thing, and the issue is the cheapest place to find that out.

- **A feature** says what is wanted and why. It can be short; the details are worked out in the issue.
- **A bug** says what happened, what was expected, and the smallest workflow that shows it.

A decision the maintainer takes about an issue, wherever it is taken, such as in a chat, is recorded at once as a comment on the issue, headed "Decided so far (continued)", dated, attributed to the maintainer, and saying so when an agent wrote it. Once an issue is agreed, every decision taken in its comments is written into its body, which then binds the work. The comments stay as the history of how each decision was reached, and nothing in them may contradict the body.

Issues carry one of these labels: `feature`, `bug`, `docs` or `process`.

Please do not open a pull request for a feature before its issue is agreed and its behaviour is written in [docs/BEHAVIOUR.md](docs/BEHAVIOUR.md). Put implementation ideas in the issue instead, where they are welcome.

## The documents

- **[docs/BEHAVIOUR.md](docs/BEHAVIOUR.md)** is what the action promises, in terms a test can observe: its inputs, what it installs and from where, the messages it stops with, its annotations, how it publishes the site on GitHub Pages, and how its versions relate to those of `ghg`. A feature is written here, in a pull request of its own, before it is built. When we say "the spec", we mean this document.
- **[AGENTS.md](AGENTS.md)** is how the work is done: the rules, how the code is organised and written, how a change is reviewed, and how to build and test it.
- **[README.md](README.md)** is what a person writing a workflow reads: how to use the three actions, their inputs, how they publish the site, and their versions.

## Pull requests

We work trunk-based: small pull requests straight to `main`, no long-lived branches.

- **Name the issue.** Every pull request names an open issue of this repository: `Closes #N` when it finishes the issue, `Refs #N` when it contributes to it. A check refuses a pull request that names none.
- **Stack large changes.** A change too large for one pull request becomes a stack: a chain of pull requests, each building on the one before, reviewed and merged in order. Each says `Refs #N`, and the last says `Closes #N`. See "Stacked pull requests" below.
- **Keep it focused.** One thing per pull request, described in plain prose: what changed and why.
- **Reuse before writing.** Code that does something general, such as calling GitHub's API, first looks for what already does it: this repository's own code, the official `@actions/*` packages of the Actions toolkit, then a maintained package. The pull request says what was considered when it writes its own, as AGENTS.md, rule 10, describes.
- **Merge without squashing.** Pull requests merge with a merge commit or a rebase, never squashed, because a squash folds every commit's message into one, and the release notes are built from each commit's changelog trailers.

### Stacked pull requests

A stack is a chain of pull requests, declared to GitHub as a stack so that it shows and merges as one (GitHub's stacked pull requests, the same ones the `gh stack` extension makes). Neither the `gh stack` extension nor anything else needs to be installed: the REST API does all of it.

1. **Chain the branches.** The bottom layer's base is `main`; each layer above has the branch of the layer below as its base, such as `gh api repos/OWNER/REPO/pulls -f base=<branch below> -f head=<branch>`.
2. **Declare the stack.** Once at least two layers exist, `POST /repos/OWNER/REPO/stacks` with the pull request numbers from bottom to top, `{"pull_requests": [12, 13]}`. A layer added later is appended with `POST /repos/OWNER/REPO/stacks/<stack number>/add`, giving only the new numbers, bottom to top. `GET /repos/OWNER/REPO/stacks?pull_request=<number>` finds the stack a pull request belongs to.
3. **Say where each layer sits.** Each description says its place, such as "2 of 3", and what the layers below it already do.
4. **Merge bottom up.** A layer is merged only after the layers below it.
5. **Keep the stack linear.** Every layer sits on the current tip of the layer below. A fix to a lower layer is a new commit on that layer's branch only; a lower branch is never merged into an upper one, because GitHub's restack drops merge commits, and the conflicts they settled come back. When a layer merges, GitHub retargets the layer above to `main` and rebases the layers above it. When it cannot, each layer above is rebased onto the new tip of the one below, bottom first, and pushed with `git push --force-with-lease`. This rebase, and rewording a pushed commit message that the commit message check refuses, followed by the same rebase of the layers above, are the only rewrites of history allowed, and only of one's own layers.

### Commit messages

Subjects follow [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): description`, with `!` before the colon for a breaking change. The types are `build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`, `revert` and `test`.

A feature, a fix or a breaking change carries its changelog entries as trailers, which the changelog is built from:

```text
feat(inputs): an input for every option of ghg build

Added: every option of ghg build has an input of the same name.
```

The trailers are `Added`, `Changed`, `Fixed` and `Removed`. A feature or fix that changes nothing a user can see says `Changelog: none` instead.

Each entry is one line. [git-cliff](https://git-cliff.org/) gathers the entries of every commit since the last release, with the template in `cliff.toml`, and the commit message check refuses an entry git-cliff would not read whole.

## Checks

Every pull request runs:

- the issue check, the check that no closing keyword names another repository's issue, and the commit message check, from [itinera-dev/actions](https://github.com/itinera-dev/actions);
- a check that fails while the description has an unticked checkbox, so that a manual check is finished before merging;
- the action's own checks: the TypeScript type-checked, the unit tests, and the files of `dist/`, the bundles and their licences, built again and compared with the committed ones, which must not differ;
- the action itself, run with `uses: ./` on a runner of each platform `ghg` is built for, as [docs/BEHAVIOUR.md](docs/BEHAVIOUR.md) describes, its inputs and `ghg-options.json` compared with the options of the `ghg` release `ghg-options.json` names as `tested`, and each release `ghg-options.json` names checked to have exactly the options it gives that release; and the publish and preview actions, run with `uses: ./publish` and `uses: ./preview` until they stop at an input they cannot use. Their publishing itself is checked by the unit tests, against a repository on disk, by the job below, and in use by `.github/workflows/site.yml` and `.github/workflows/preview.yml`;
- the three actions end to end, on every platform of the job above: the scenarios of `features/`, written in Gherkin, each running a workflow through act against stand-ins for GitHub's API and its git server, which check what a workflow sees, the branch Pages serves and the comments on a pull request included.

AGENTS.md, "Building and testing", gives the command of each.

`.github/workflows/site.yml` publishes the scenarios of `features/` as the action's own site on GitHub Pages, with the publish action of the commit it runs on: a version for `main`, and one for each release, which the release workflow calls it for once the release is made, so that a tag it refuses is never published. `.github/workflows/preview.yml` publishes, with the preview action, a preview of each pull request, whose address a comment on it gives, removed when it closes.

Every action a workflow uses is pinned to a commit, with its version in a comment beside it. Each week, `.github/workflows/weekly.yml` checks whether the newest `ghg` of the same major version has an option that `ghg-options.json` does not name, and runs the action with it on every platform, so that an option of `ghg` the action has no input for yet, or a release of `ghg` that breaks it, is known.

## Releases

Versions follow [Semantic Versioning](https://semver.org/). The action shares only its major version with `ghg`, and has minor and patch numbers of its own. Its inputs, the messages it stops with and the release of `ghg` it installs by default are part of what is promised, so removing or renaming an input, or installing a `ghg` of another major version by default, is a major version. [docs/BEHAVIOUR.md](docs/BEHAVIOUR.md), "Versions", says how the two relate.

### Preparing a release

A release starts as a pull request, titled "Release <version>", whose commit `chore(release): release <version>`:

1. raises the version in `package.json`, and in `package-lock.json` with `npm version <version> --no-git-tag-version`;
2. writes the version's section at the top of `CHANGELOG.md`, starting from what `git cliff --unreleased --tag v<version> --strip all` prints, which is the heading `## [<version>]` and the entries of the commits since the last release;
3. reconciles those entries, since a commit's entries cannot change once it merges: entries a later commit made untrue become one that says what the release holds, entries that say the same thing merge, and a change a user meets that carries no entry gets one.

The template is written for git-cliff 2.14.2, which installs with `cargo install git-cliff --version 2.14.2 --locked` or `pip install git-cliff==2.14.2`.

### Tagging it

Once the pull request has merged, a maintainer tags the commit the merge put on `main` and pushes the tag, such as `git tag -a v1.0.0 <commit> -m "gherkin-glass-action 1.0.0"` and `git push origin v1.0.0`. Only maintainers push tags.

The release workflow, `.github/workflows/release.yml`, then:

1. refuses the tag unless it is `v` and the version in `package.json`, its commit is on `main`, and `CHANGELOG.md` has notes for the version;
2. runs every check of `.github/workflows/action.yml` again on the tagged commit, the files of `dist/`, the bundle and its licences, against a fresh build among them, since their run on `main` after a merge blocks nothing;
3. creates the GitHub release with `.github/release/publish.sh`, titled with the tag and with the version's section of `CHANGELOG.md` as its notes, and no files, since a workflow runs the action from the tagged commit;
4. moves the major version's tag, such as `v1`, to the release, when it is the newest release of that major version, as docs/BEHAVIOUR.md, "Versions", says.
5. publishes the release's version of the action's own site, with `.github/workflows/site.yml`.

### Publishing to the Marketplace

GitHub publishes an action to the Marketplace only through a checkbox on its release's page, with two-factor sign-in, and no API. So after each release, a maintainer edits the release on GitHub, ticks "Publish this Action to the GitHub Marketplace", and saves it. The first time, the maintainer also accepts the Marketplace Developer Agreement.

## Writing style

Everything we write must be readable with a screen reader: documentation, issues, pull requests and comments. Use headings, lists, prose and simple tables.

Diagrams are Mermaid diagrams, in fenced code blocks marked `mermaid`, which GitHub renders. Every diagram declares `accTitle` and `accDescr`, and is accompanied by text that says everything the diagram shows. Do not use ASCII-art diagrams, arrows drawn with characters, or box-drawing trees.

## Licence

Unless you explicitly state otherwise, any contribution intentionally submitted for inclusion in the work by you, as defined in the Apache-2.0 licence, shall be dual licensed under MIT and Apache-2.0, without any additional terms or conditions.
