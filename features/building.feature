Feature: Building the site
  With build: true, the action runs ghg build with an input for each of its options, and reads
  how the build ended (docs/BEHAVIOUR.md, "Building").

  Background:
    Given the repository holds the feature file "features/shop/basket.feature"

  @rule-7
  Scenario: The site is built into the folder ghg writes by default
    When a push runs the action with:
      | ghg-version | 1.1.0 |
      | build       | true  |
    Then the action passes
    And the workspace holds "site/index.html"

  @rule-8
  Scenario: Each input is an option of ghg build
    When a push runs the action with:
      | ghg-version | 1.1.0           |
      | build       | true            |
      | output      | public/features |
      | title       | Our features    |
    Then the action passes
    And the workspace holds "public/features/index.html"
    And the page "public/features/index.html" says "Our features"

  @rule-8
  Scenario: keep-in-output keeps what each of its lines names in the output folder
    Given the repository holds the file "public/notes.txt" with "kept"
    And the repository holds the file "public/robots.txt" with "kept too"
    When a push runs the action with:
      | ghg-version    | 1.1.0                    |
      | build          | true                     |
      | output         | public                   |
      | keep-in-output | notes.txt\n\nrobots.txt  |
    Then the action passes
    And the workspace holds "public/index.html"
    And the workspace holds "public/notes.txt"
    And the workspace holds "public/robots.txt"

  @rule-8
  Scenario: What keep-in-output does not name stops the build, which ghg refuses
    Given the repository holds the file "public/notes.txt" with "not kept"
    When a push runs the action with:
      | ghg-version | 1.1.0  |
      | build       | true   |
      | output      | public |
    Then the action fails with "ghg build stopped with status 1."

  @rule-7
  Scenario: An input that holds no feature file builds nothing, and the step passes
    Given the repository holds the file "docs/notes.md" with "Not a feature file."
    When a push runs the action with:
      | ghg-version | 1.1.0 |
      | build       | true  |
      | input       | docs  |
    Then the action passes
    And the workspace does not hold "site"

  @rule-7
  Scenario: A value of build that is neither true nor false stops the action
    When a push runs the action with:
      | build | yes |
    Then the action fails with "build must be true or false."
