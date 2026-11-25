# gherkin-glass-action

GitHub Actions for [gherkin-glass](https://github.com/marlon-sousa/gherkin-glass), the accessible static viewer for Gherkin feature files. This repository holds three:

| Action | What it does |
| --- | --- |
| `marlon-sousa/gherkin-glass-action@v1` | Installs `ghg`, the command of gherkin-glass, and builds a site with it when asked. |
| `marlon-sousa/gherkin-glass-action/publish@v1` | Builds a version of the site and publishes it on the branch GitHub Pages serves, as [Publishing a version](#publishing-a-version) describes. |
| `marlon-sousa/gherkin-glass-action/preview@v1` | Publishes a preview of each pull request's site beside the versions, comments its address on the pull request, and removes it when the pull request closes, as [Previewing a pull request](#previewing-a-pull-request) describes. |

They run on GitHub's own runners and on self-hosted ones, on Linux on x86-64 or ARM64, macOS on Intel or Apple silicon, and Windows on x86-64 or ARM64. They need nothing installed on the runner, not even Node on the `PATH`, except that publish and preview need git 2.31 or later, as GitHub's own runners have.

## Installing and building

This step installs the newest `ghg` 1.x and builds the site of the feature files in `features`, as `ghg.toml` in the repository's root says, into `site`:

```yaml
- uses: actions/checkout@v7
- uses: marlon-sousa/gherkin-glass-action@v1
  with:
    build: true
```

Without `build: true`, the action only installs `ghg` and puts it on the `PATH` of the job's later steps, which may then run it themselves, such as `ghg build --title "Our features"`.

When the build reports a feature file that cannot be read, each problem shows as an error annotation on the file and the line, in the workflow's summary and among a pull request's changes, and the step fails. The action also registers a problem matcher, so that a later step that runs `ghg build` itself has each problem it reports on a file and a line annotated too, at the path `ghg` prints. When the input holds no feature file, `ghg` writes nothing and says so, and the step passes. The action reads how the build ended from the report `ghg build --message-format=json` prints, which it asks for itself, so building needs `ghg` 1.1.0 or newer.

| Input | Default | What it sets |
| --- | --- | --- |
| `ghg-version` | the newest stable `ghg` of the action's major version | The release of `ghg` to install, such as `1.2.0` or `v1.2.0`, a pre-release such as `1.3.0-rc.1` included; 1.1.0 or newer to build. |
| `build` | `false` | `true` runs `ghg build` after installing it, in the workspace folder. |
| `token` | the workflow's own token | The token that lists the releases of `ghg` through GitHub's API, sent only on github.com. |
| `config` | empty | The `--config` option of `ghg build`, the configuration file to read. |
| `input` | empty | The `--input` option of `ghg build`, the folder of feature files to read. |
| `output` | empty | The `--output` option of `ghg build`, the folder the site is written into. |
| `title` | empty | The `--title` option of `ghg build`, the site's title. |
| `version-name` | empty | The `--version-name` option of `ghg build`, the version of the suite the site is built as. |
| `front-page` | empty | The `--front-page` option of `ghg build`, the Markdown template of the site's front page. |
| `only` | empty | The `--only` option of `ghg build`, the file listing the feature files to build the site from, alone. |
| `preview` | empty | `true` gives `ghg build` the `--preview` option, a site whose every page asks search engines not to index it. |
| `keep-in-output` | empty | The `--keep-in-output` option of `ghg build`, the patterns of what `ghg` leaves alone in the output folder, in the gitignore syntax, one on each line, such as `.nojekyll` and `CNAME`. |

An input of an option that is empty is left out, so that the configuration file and `ghg`'s defaults still apply. gherkin-glass's [README](https://github.com/marlon-sousa/gherkin-glass#readme) says what each option does.

| Output | What it holds |
| --- | --- |
| `ghg-version` | The release of `ghg` installed, such as `1.2.0`. |
| `site` | The folder the build wrote the site into, relative to the workspace, such as `site`; empty when the action does not build, or the input holds no feature file. A later step can upload it, or deploy it its own way. |

## Publishing on GitHub Pages

The publish and preview actions build the site themselves, so a job that publishes needs neither `build: true` nor the root action. Each installs `ghg` as the root action does, builds into the branch Pages serves, commits what changed and pushes it. When nothing changed since the last push, it pushes nothing.

### Setting up Pages once

1. Make the branch Pages will serve, `gh-pages` unless you choose another, with an empty `.nojekyll` file at its root. Without it, Pages runs Jekyll on the branch, which leaves out every page whose name starts with `_`, such as the page of `_draft.feature`, so the actions refuse to publish there. When the branch does not exist, either action makes it, with no files, and stops, asking for the next step and for `.nojekyll`.
2. In the repository's Settings, under Pages, set the source to "Deploy from a branch" and choose that branch, with its root, or a folder that holds the folder the site goes into, such as `/docs` for a `folder` of `docs/features`. Put `.nojekyll` at the root of the folder Pages serves.
3. Give the job these permissions: `contents: write` to push the branch, `pages: read` to read how Pages is set, and, for preview, `pull-requests: write` to comment.

Each action stops with a sentence that says what is missing when Pages is not set this way.

### Where the site goes

The input `folder` names the folder of the branch the site goes into, such as `features`; empty, it is the branch's root. The rest of the branch is never touched, so the branch can hold a site of its own beside the folder. Both actions keep `.nojekyll` and `CNAME` at the root of the folder the site goes into, so the site can go into the branch's root. Anything else there that `ghg` did not write, such as a `README.md`, is kept by naming it in `keep-in-output`, or in the configuration file's `keep_in_output`.

Within that folder, `ghg` decides, as it does for any versioned site:

- A folder that does not exist yet, or is empty, is made, and marked as `ghg`'s, with `ghg-versions.json`.
- A version is added beside the versions already there, and the versions page lists them all.
- A version of a name already there is replaced, so publishing the same version again brings it up to date.
- A folder that holds anything `ghg` did not write, such as a page of another site, is refused, and nothing is written or deleted.
- Previews go into `previews/pr-<number>` inside that folder, which `ghg` leaves alone.
- When the input holds no feature file, nothing is published, and an earlier version or preview stays as it is.

### Publishing a version

```yaml
on:
  push:
    branches: [main]
    tags: ["v*"]

permissions:
  contents: write
  pages: read

# One run at a time, so that an older run never pushes after a newer one.
concurrency:
  group: site-${{ github.ref }}

jobs:
  site:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: marlon-sousa/gherkin-glass-action/publish@v1
        with:
          folder: features
```

A push of `main` publishes the version `main`, and the tag `v1.2.0` the version `v1.2.0`, each at its own address, such as `https://owner.github.io/repo/features/v1.2.0/`. The version is named by the tag or branch that ran, with every `/` made a `-`, such as `feature-login` for `feature/login`, or by `version-name`. The action runs on any event, such as a release or a run by hand.

### Previewing a pull request

```yaml
on:
  pull_request:
    types: [opened, synchronize, reopened, closed]

permissions:
  contents: write
  pages: read
  pull-requests: write

# One run at a time for each pull request, so that an older run never pushes after a newer one.
concurrency:
  group: preview-${{ github.event.pull_request.number }}

jobs:
  preview:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: marlon-sousa/gherkin-glass-action/preview@v1
        with:
          folder: features
```

The preview's title names its pull request, such as "Shop, pull request #12": the action adds ", pull request #12" to the site's title, which is `title`, else the `title` of the configuration file when there is one, else ghg's own, "Feature files". The preview is built so that search engines are asked not to index it, and its address is written in one comment on the pull request, edited on every later push. The `closed` type is needed for the preview to be removed when the pull request closes, merged or not; the comment then says so.

The comment also records, in a line that is not shown, the commit the preview was built from. A later push whose commits since that one change no file the preview is built from, neither a feature file of the input folder nor the configuration file or the front page, leaves the preview as it is; a change to the workflow alone, such as to `title`, does not count, nor does a change to the base branch, so either shows on the next push that changes one of those files. A run that failed or was cancelled leaves the comment as it was, so the next run builds what it missed. With `changed-only: true`, a preview shows only the feature files the pull request changes, at most the first 3000 that GitHub lists, and none is published when it changes none. A pull request from a fork gets no preview, since the workflow's token cannot push from it.

A project that publishes its site its own way can use preview alone, as long as its own publishing leaves `previews/` on the branch alone.

### Inputs and outputs

Both actions take these inputs:

| Input | Default | What it sets |
| --- | --- | --- |
| `to` | `github-pages` | Where the site is published; GitHub Pages deploying from a branch is the only place today. |
| `branch` | `gh-pages` | The branch Pages serves. |
| `folder` | the branch's root | The folder of `branch` the site goes into, such as `features`. |
| `ghg-version` | the newest stable `ghg` of the action's major version | The release of `ghg` to install, 1.1.0 or newer. |
| `token` | the workflow's own token | The token that reads Pages, pushes and comments on the workflow's own server, and lists the releases of `ghg` on github.com. |
| `config`, `input`, `front-page` | empty | The options of `ghg build` of the same names, as for the root action. |
| `title` | empty | The `--title` option of `ghg build`, the site's title. preview adds ", pull request #<number>" to it, or, when it is empty, to the configuration file's `title`, else to "Feature files". |
| `keep-in-output` | empty | The patterns of what `ghg` leaves alone in the folder the site goes into, one on each line, after `/.nojekyll` and `/CNAME`, which are always kept. When it is empty, the configuration file's `keep_in_output` is used instead. |

publish also takes `version-name`, the name of the version, by default the tag or branch that ran. preview also takes `changed-only`, `false` by default.

Each gives the output `address`, the address of the version or the preview it published.

## Versions

The three actions are released together, under one version, which shares its major version with `ghg`: v1 installs `ghg` 1.x, and never a 2.x. The minor and patch numbers are the actions' own. `@v1` always names the newest 1.x release, and a full version, such as `@v1.0.0`, never changes. A new input, for an option a newer `ghg` adds, comes in a minor release of the action; a release of `ghg` that adds no option needs none. The actions work with any `ghg` of their major version that has the options they pass: `ghg-options.json` names the first release of `ghg` with each option, and when `ghg-version` names an older one, the action stops before downloading it, naming each input that needs a newer `ghg`, such as `keep-in-output needs ghg 1.1.0 or newer, not 1.0.0.`

[docs/BEHAVIOUR.md](docs/BEHAVIOUR.md) says everything the actions promise, the messages they stop with among them.

## Contributing

[CONTRIBUTING.md](CONTRIBUTING.md) describes how the actions are planned, built and released, and [AGENTS.md](AGENTS.md) how to work on it.

## Licence

Licensed under either of the [Apache License, Version 2.0](LICENSE-APACHE) or the [MIT licence](LICENSE-MIT), at your option. The actions' bundles, in `dist/`, also hold the packages that [dist/licenses.txt](dist/licenses.txt) lists, each under its own licence.
