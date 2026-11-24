Feature: Publishing on GitHub Pages
  The publish and preview actions read how Pages is set, keep the files Pages reads, and push what
  they build to the branch Pages serves (docs/BEHAVIOUR.md, "Publishing"). The publish action
  shows what both do.

  Background:
    Given the repository holds the feature file "features/shop/basket.feature"

  @rule-20
  Scenario: Pages built by a workflow is not served from the branch
    Given Pages deploys with a workflow
    And the branch "gh-pages" holds:
      | .nojekyll |
    When a push runs the publish action with:
      | ghg-version | 1.1.0 |
    Then the action fails with "Pages does not deploy from the branch gh-pages: in the repository's Settings, under Pages, set the source to \"Deploy from a branch\" and choose gh-pages."

  @rule-20
  Scenario: A missing branch is made, and the maintainer is told how to set Pages to it
    Given Pages deploys with a workflow
    When a push runs the publish action with:
      | ghg-version | 1.1.0 |
    Then the action fails with "The branch gh-pages is made: in the repository's Settings, under Pages, set the source to \"Deploy from a branch\" and choose gh-pages, and add an empty .nojekyll file at its root."
    And the branch "gh-pages" has 1 commit

  @rule-20
  Scenario: Pages serving another folder than the one folder names is refused
    Given Pages deploys from the branch "gh-pages", serving "/docs"
    And the branch "gh-pages" holds:
      | docs/.nojekyll |
    When a push runs the publish action with:
      | ghg-version | 1.1.0    |
      | folder      | features |
    Then the action fails with "Pages serves the folder /docs of gh-pages, so folder must be in it."

  @rule-19 @rule-21
  Scenario: A version goes into the branch's root, which keeps the files Pages reads
    Given Pages deploys from the branch "gh-pages", serving "/"
    And the branch "gh-pages" holds:
      | .nojekyll |
      | CNAME     |
    When a push runs the publish action with:
      | ghg-version  | 1.1.0  |
      | version-name | v1.0.0 |
    Then the action passes
    And the branch "gh-pages" holds "v1.0.0/index.html"
    And the branch "gh-pages" holds ".nojekyll"
    And the branch "gh-pages" holds "CNAME"
    And the output "address" is "https://owner.github.io/repo/v1.0.0/"

  @rule-19
  Scenario: keep-in-output keeps more files at the root of the output folder
    Given Pages deploys from the branch "gh-pages", serving "/"
    And the branch "gh-pages" holds:
      | .nojekyll |
      | README.md |
    When a push runs the publish action with:
      | ghg-version    | 1.1.0     |
      | keep-in-output | README.md |
    Then the action passes
    And the branch "gh-pages" holds "README.md"
    And the branch "gh-pages" holds "main/index.html"

  @rule-21
  Scenario: A branch without .nojekyll is left alone
    Given Pages deploys from the branch "gh-pages", serving "/"
    And the branch "gh-pages" holds:
      | index.html |
    When a push runs the publish action with:
      | ghg-version | 1.1.0 |
    Then the action fails with "Pages runs Jekyll on gh-pages, which leaves out pages whose names start with _: add an empty .nojekyll file to the folder / of gh-pages."
    And the branch "gh-pages" has 1 commit

  @rule-22
  Scenario: Publishing the same site again changes nothing
    Given Pages deploys from the branch "gh-pages", serving "/"
    And the branch "gh-pages" holds:
      | .nojekyll |
    And a push has published the site
    When a push runs the publish action with:
      | ghg-version | 1.1.0 |
    Then the action passes
    And the log says "The site on gh-pages is already up to date."
    And the branch "gh-pages" has 2 commits

  @rule-22
  Scenario: A token that may not push is told so
    Given Pages deploys from the branch "gh-pages", serving "/"
    And the branch "gh-pages" holds:
      | .nojekyll |
    And the token may not push
    When a push runs the publish action with:
      | ghg-version | 1.1.0 |
    Then the action fails with "The site cannot be pushed to gh-pages: the workflow needs the permission contents: write."
    And the branch "gh-pages" has 1 commit
