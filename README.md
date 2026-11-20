# gherkin-glass-action

A GitHub Action that installs `ghg`, the command of [gherkin-glass](https://github.com/marlon-sousa/gherkin-glass), the accessible static viewer for Gherkin feature files, and builds a site with it when asked. It can also publish that site on the branch GitHub Pages serves, with a preview of each pull request beside it.

## Using it

This step installs the newest `ghg` 1.x and builds the site of the feature files in `features`, as `ghg.toml` in the repository's root says, into `site`:

```yaml
- uses: actions/checkout@v7
- uses: marlon-sousa/gherkin-glass-action@v1
  with:
    build: true
```

Without `build: true`, the action only installs `ghg` and puts it on the `PATH` of the job's later steps, which may then run it themselves, such as `ghg build --title "Our features"`.

When the build reports a feature file that cannot be read, each problem shows as an error annotation on the file and the line, in the workflow's summary and among a pull request's changes, and the step fails.

The action runs on GitHub's own runners and on self-hosted ones, on Linux on x86-64 or ARM64, macOS on Intel or Apple silicon, and Windows on x86-64. It needs nothing installed on the runner, not even Node on the `PATH`, except to publish the site, which needs git 2.31 or later, as GitHub's own runners have.

## Inputs

| Input | Default | What it sets |
| --- | --- | --- |
| `ghg-version` | the newest stable `ghg` of the action's major version | The release of `ghg` to install, such as `1.2.0` or `v1.2.0`, a pre-release such as `1.3.0-rc.1` included. |
| `build` | `false` | `true` runs `ghg build` after installing it, in the workspace folder. |
| `token` | the workflow's own token | The token that lists the releases of `ghg` through GitHub's API, sent for that only on github.com, and that publishes the site, on the workflow's own server. |
| `publish` | `false` | `true` publishes the site on the branch Pages serves: a version on a push, a preview on a pull request, removed when it closes. |
| `publish-branch` | `gh-pages` | The branch Pages serves, which the site is published on. |
| `publish-folder` | the branch's root | The folder of `publish-branch` the site goes into, such as `features`. |
| `changed-only` | `false` | `true` makes a pull request's preview show only the feature files it changes, and publishes none when it changes no file of the input folder. |
| `config` | empty | The `--config` option of `ghg build`, the configuration file to read. |
| `input` | empty | The `--input` option of `ghg build`, the folder of feature files to read. |
| `output` | empty | The `--output` option of `ghg build`, the folder the site is written into. |
| `title` | empty | The `--title` option of `ghg build`, the site's title. |
| `version-name` | empty | The `--version-name` option of `ghg build`, the version of the suite the site is built as. |
| `front-page` | empty | The `--front-page` option of `ghg build`, the Markdown template of the site's front page. |
| `only` | empty | The `--only` option of `ghg build`, the file listing the feature files to build the site from, alone. |
| `preview` | empty | `true` gives `ghg build` the `--preview` option, a site whose every page asks search engines not to index it. |

An input of an option that is empty is left out, so that the configuration file and `ghg`'s defaults still apply. gherkin-glass's [README](https://github.com/marlon-sousa/gherkin-glass#readme) says what each option does.

## Publishing

With `publish: true`, the action builds the site and pushes it to the branch GitHub Pages serves, `gh-pages` unless `publish-branch` names another:

- On a push, it adds a version of the site, named after the branch or tag pushed, or `version-name`, beside the versions already there, under `ghg`'s versions page.
- On a pull request, it publishes a preview, which search engines are asked not to index, in `previews/pr-<number>`, and writes its address in one comment on the pull request, edited on every later push.
- When a pull request closes, merged or not, it removes that preview, and says so in the comment.

When nothing changed since the last push, it pushes nothing. A pull request from a fork gets no preview, since the workflow's token cannot push from it.

Pages must deploy from that branch: in the repository's Settings, under Pages, set the source to "Deploy from a branch" and choose it, with its root, or a folder that holds `publish-folder`, such as `/docs` for a `publish-folder` of `docs/features`. When the branch does not exist yet, the action makes it and stops, asking for that setting, since Pages can be set only to a branch that exists. Run the workflow again once it is set.

The job needs these permissions:

```yaml
on:
  push:
    branches: [main]
  pull_request:
    types: [opened, synchronize, reopened, closed]

permissions:
  contents: write
  pages: read
  pull-requests: write

jobs:
  site:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: marlon-sousa/gherkin-glass-action@v1
        with:
          publish: true
```

The `closed` type is needed for the preview to be removed, since a pull request's workflow does not run when it closes otherwise.

When the branch already holds other files, such as another site or a `CNAME`, set `publish-folder` to a folder of its own, such as `features`, so that `ghg` writes only there. A project that publishes its site its own way can let the action publish only the previews, with `publish: ${{ github.event_name == 'pull_request' }}`, as long as its own publishing leaves `previews/` on the branch alone.

With `changed-only: true`, a preview shows only the feature files the pull request changes, and no preview is published when it changes no file of the input folder.

## Versions

The action shares its major version with `ghg`: action v1 installs `ghg` 1.x, and never a 2.x. Its minor and patch numbers are its own. `@v1` always names the newest 1.x release of the action, and a full version, such as `@v1.0.0`, never changes. A new input, for an option a newer `ghg` adds, comes in a minor release of the action.

[docs/BEHAVIOUR.md](docs/BEHAVIOUR.md) says everything the action promises, the messages it stops with among them.

## Contributing

[CONTRIBUTING.md](CONTRIBUTING.md) describes how the action is planned, built and released, and [AGENTS.md](AGENTS.md) how to work on it.

## Licence

Licensed under either of the [Apache License, Version 2.0](LICENSE-APACHE) or the [MIT licence](LICENSE-MIT), at your option. The action's bundle, `dist/index.cjs`, also holds the packages that [dist/licenses.txt](dist/licenses.txt) lists, each under its own licence.
