Feature: Publishing a version of the site
  The publish action adds a version of the site beside the versions already on the branch Pages
  serves (docs/BEHAVIOUR.md, "The publish action").

  Background:
    Given the repository holds the feature file "features/shop/basket.feature"
    And Pages deploys from the branch "gh-pages", serving "/"

  @rule-19 @rule-22 @rule-23
  Scenario: A version goes into its folder, beside what the branch already holds
    Given the branch "gh-pages" holds:
      | .nojekyll  |
      | CNAME      |
      | index.html |
    When a push runs the publish action with:
      | ghg-version | 1.1.0    |
      | folder      | features |
    Then the action passes
    And the branch "gh-pages" holds "features/main/index.html"
    And the branch "gh-pages" holds "index.html"
    And the newest commit of "gh-pages" says "Publish the site's version main"
    And the log says "The site is published on gh-pages, at https://owner.github.io/repo/features/main/."
    And the output "address" is "https://owner.github.io/repo/features/main/"

  @rule-23
  Scenario: A folder that holds what ghg did not write is refused
    Given the branch "gh-pages" holds:
      | .nojekyll |
      | README.md |
    When a push runs the publish action with:
      | ghg-version | 1.1.0 |
    Then the action fails with "ghg build stopped with status 1."
    And the branch "gh-pages" has 1 commit

  @rule-23
  Scenario: Nothing to build publishes nothing
    Given the repository holds the file "docs/notes.md" with "Not a feature file."
    And the branch "gh-pages" holds:
      | .nojekyll |
    When a push runs the publish action with:
      | ghg-version | 1.1.0 |
      | input       | docs  |
    Then the action passes
    And the log says "ghg read no feature file, so nothing is published."
    And the output "address" is ""
    And the branch "gh-pages" has 1 commit

  @rule-23
  Scenario: A branch with / in its name is a version named with -
    Given the branch "gh-pages" holds:
      | .nojekyll |
    When a push of the branch "feature/login" runs the publish action with:
      | ghg-version | 1.1.0 |
    Then the action passes
    And the branch "gh-pages" holds "feature-login/index.html"
    And the newest commit of "gh-pages" says "Publish the site's version feature-login"
