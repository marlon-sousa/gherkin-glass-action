@rule-10
Feature: Annotations
  Each problem the build reports on a file and a line is an error annotation on that file and
  line, found from the workspace (docs/BEHAVIOUR.md, "Annotations").

  Scenario: A feature file that cannot be read is annotated, and the step fails
    Given the repository holds the feature file "specs/shop/basket.feature"
    And the repository holds the file "specs/shop/broken.feature" with "Feature without a colon"
    When a push runs the action with:
      | ghg-version | 1.1.0 |
      | build       | true  |
      | input       | specs |
    Then the action fails with "ghg build stopped with status 1."
    And there is an error annotation on "specs/shop/broken.feature", line 1, saying "Syntax error."

  Scenario: A problem of the configuration file is annotated on that file
    Given the repository holds the feature file "features/basket.feature"
    And the repository holds the file "docs/ghg.toml" with "colour = 1"
    When a push runs the action with:
      | ghg-version | 1.1.0         |
      | build       | true          |
      | config      | docs/ghg.toml |
    Then the action fails with "ghg build stopped with status 1."
    And there is an error annotation on "docs/ghg.toml", line 1, saying "ghg has no setting named colour."
