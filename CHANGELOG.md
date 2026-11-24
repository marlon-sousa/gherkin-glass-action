# Changelog

Every release of gherkin-glass-action, the GitHub Action that installs `ghg` and builds a site with it. Each section is written before its release, from the changelog entries its commits carry, as [CONTRIBUTING.md](CONTRIBUTING.md), "Releases", describes, and becomes the notes of its [GitHub release](https://github.com/marlon-sousa/gherkin-glass-action/releases). Versions follow [Semantic Versioning](https://semver.org/), and the major version is that of the `ghg` the action installs.

## [1.0.0]

### Added

- The action, `marlon-sousa/gherkin-glass-action@v1`, installs ghg, by default the newest stable ghg 1.x, checked against the release's `SHA256SUMS`, and puts it on the `PATH`, on Linux and Windows on x86-64 or ARM64, and macOS on Intel or Apple silicon.
- With `build: true`, the action runs `ghg build`, with an input for each option that sets how a site is built, `keep-in-output` among them, one pattern on each line; building needs ghg 1.1.0 or newer, whose report the action reads.
- Each problem `ghg build` reports on a file and a line is an error annotation on that file and line, in a later step that runs `ghg build` itself too.
- A build that finds no feature file passes and writes nothing.
- The outputs `ghg-version` and `site` give the release of ghg installed and the folder the site was written into.
- The publish action, `marlon-sousa/gherkin-glass-action/publish@v1`, adds a version of the site to a folder of the branch GitHub Pages serves, its root included, named by `version-name` or by the tag or branch that ran, and gives its address as the output `address`.
- The preview action, `marlon-sousa/gherkin-glass-action/preview@v1`, publishes a pull request's preview beside the versions, with its address in a comment and as the output `address`, removes it when the pull request closes, and leaves it as it is after a push that changes none of its files; with `changed-only: true`, it shows only the feature files the pull request changes; a pull request from a fork gets no preview, and the step passes.
- The publish and preview actions make the branch Pages serves when it is missing, and say how to set Pages to it, keep `.nojekyll` and `CNAME`, and what `keep-in-output` or the configuration file's `keep_in_output` names, publish nothing when there is no feature file to build, and work on GitHub Enterprise Server with the workflow's own server and token.
