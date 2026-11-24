Feature: Previewing a pull request's feature files on GitHub Pages
  The preview action publishes a preview of each pull request beside the site's versions, gives
  its address in one comment, and removes it when the pull request closes (docs/BEHAVIOUR.md,
  "The preview action").

  Background:
    Given the repository holds the feature file "features/shop/basket.feature"
    And Pages deploys from the branch "gh-pages", serving "/"

  @rule-24
  Scenario: A push is not a pull request
    When a push runs the preview action with:
      | ghg-version | 1.1.0 |
    Then the action fails with "preview acts on a pull request, not on push."

  @rule-25
  Scenario: A pull request from a fork publishes nothing, and passes
    When pull request #12 from a fork runs the preview action
    Then the action passes
    And there is a notice saying "This pull request comes from a fork, whose token cannot push, so its preview is not published."
    And the log does not say "ghg 1.1.0 is installed."

  @rule-26 @rule-27
  Scenario: An opened pull request gets its preview, and a comment with its address
    Given the branch "gh-pages" holds:
      | .nojekyll |
    And pull request #12 has no comment
    When pull request #12 is opened, and runs the preview action with:
      | ghg-version | 1.1.0 |
    Then the action passes
    And the branch "gh-pages" holds "previews/pr-12/index.html"
    And the newest commit of "gh-pages" says "Publish the preview of pull request #12"
    And the log says "The site is published on gh-pages, at https://owner.github.io/repo/previews/pr-12/."
    And the output "address" is "https://owner.github.io/repo/previews/pr-12/"
    And a comment is added saying "<!-- gherkin-glass-action preview -->\n<!-- built from bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb -->\nThe preview of this pull request's feature files is at https://owner.github.io/repo/previews/pr-12/."

  @rule-27
  Scenario: A comment that cannot be written stops the action
    Given the branch "gh-pages" holds:
      | .nojekyll |
    And pull request #12 has no comment, and none may be written
    When pull request #12 is opened, and runs the preview action with:
      | ghg-version | 1.1.0 |
    Then the action fails with "The comment of the pull request's preview cannot be written."

  @rule-26 @rule-27
  Scenario: A closed pull request's preview is removed, and its comment says so
    Given the branch "gh-pages" holds:
      | .nojekyll |
    And pull request #12 has its preview on the branch
    And pull request #12 has the preview's comment, built from "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    When pull request #12 is closed, and runs the preview action with:
      | ghg-version | 1.1.0 |
    Then the action passes
    And the branch "gh-pages" does not hold "previews/pr-12"
    And the newest commit of "gh-pages" says "Remove the preview of pull request #12"
    And the log says "The preview of pull request #12 is removed from gh-pages."
    And the log does not say "ghg 1.1.0 is installed."
    And the preview's comment is edited to say "<!-- gherkin-glass-action preview -->\nThe preview of this pull request was removed when it closed."

  @rule-28
  Scenario: changed-only shows only the feature files the pull request changes
    Given the repository holds the feature file "features/shop/checkout.feature"
    And the branch "gh-pages" holds:
      | .nojekyll |
    And pull request #12 has no comment
    And pull request #12 changes:
      | file                           | status   |
      | features/shop/checkout.feature | modified |
      | features/shop/old.feature      | removed  |
      | README.md                      | modified |
    When pull request #12 is opened, and runs the preview action with:
      | ghg-version  | 1.1.0 |
      | changed-only | true  |
    Then the action passes
    And the branch "gh-pages" holds "previews/pr-12/shop/checkout.html"
    And the branch "gh-pages" does not hold "previews/pr-12/shop/basket.html"

  @rule-28
  Scenario: changed-only with no file of the input folder changed publishes nothing
    Given the branch "gh-pages" holds:
      | .nojekyll |
    And pull request #12 changes:
      | file      | status   |
      | README.md | modified |
    When pull request #12 is synchronize, and runs the preview action with:
      | ghg-version  | 1.1.0 |
      | changed-only | true  |
    Then the action passes
    And the log says "This pull request changes no file of the input folder, so no preview is published."
    And the branch "gh-pages" has 1 commit
    And no comment is written

  @rule-26 @rule-28
  Scenario: changed-only with no feature file changed leaves the earlier preview as it is
    Given the repository holds the file "features/shop/notes.md" with "Not a feature file."
    And the branch "gh-pages" holds:
      | .nojekyll |
    And pull request #12 has its preview on the branch
    And pull request #12 has the preview's comment, built from "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    And pull request #12 changes:
      | file                   | status |
      | features/shop/notes.md | added  |
    When pull request #12 is synchronize, and runs the preview action with:
      | ghg-version  | 1.1.0 |
      | changed-only | true  |
    Then the action passes
    And the log says "ghg read no feature file, so no preview is published."
    And the branch "gh-pages" has 2 commits
    And the branch "gh-pages" holds "previews/pr-12/index.html"
    And no comment is written

  @rule-29
  Scenario: A preview whose sources have not changed is not built again
    Given the branch "gh-pages" holds:
      | .nojekyll |
    And pull request #12 has its preview on the branch
    And pull request #12 has the preview's comment, built from "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    And the commits since "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" change:
      | file                         | status   |
      | README.md                    | modified |
      | .github/workflows/pages.yml  | modified |
    When pull request #12 is synchronize, and runs the preview action with:
      | ghg-version | 1.1.0 |
    Then the action passes
    And the log says "The commits since the preview was built change no file it is built from, so the preview is left as it is."
    And the branch "gh-pages" has 2 commits
    And the preview's comment is edited to say "<!-- built from bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb -->"

  @rule-29
  Scenario: A preview whose sources changed is built again
    Given the branch "gh-pages" holds:
      | .nojekyll |
    And pull request #12 has its preview on the branch
    And the repository holds the feature file "features/shop/checkout.feature"
    And pull request #12 has the preview's comment, built from "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    And the commits since "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" change:
      | file                           | status |
      | features/shop/checkout.feature | added  |
    When pull request #12 is synchronize, and runs the preview action with:
      | ghg-version | 1.1.0 |
    Then the action passes
    And the branch "gh-pages" has 3 commits
    And the branch "gh-pages" holds "previews/pr-12/shop/checkout.html"
    And the newest commit of "gh-pages" says "Publish the preview of pull request #12"
    And the preview's comment is edited to say "<!-- built from bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb -->"
