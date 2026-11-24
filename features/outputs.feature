@rule-18
Feature: Outputs
  The action gives the job's later steps the ghg it installed, and the folder the build wrote
  (docs/BEHAVIOUR.md, "Outputs").

  Background:
    Given the repository holds the feature file "features/shop/basket.feature"

  Scenario: Without a build, the ghg installed is given, and no folder
    When a push runs the action with:
      | ghg-version | 1.1.0 |
    Then the action passes
    And the output "ghg-version" is "1.1.0"
    And the output "site" is ""

  Scenario: The folder the build wrote is given from the workspace
    When a push runs the action with:
      | ghg-version | 1.1.0           |
      | build       | true            |
      | output      | public/features |
    Then the action passes
    And the output "site" is "public/features"

  Scenario: The folder ghg builds into by default is given too
    When a push runs the action with:
      | ghg-version | 1.1.0 |
      | build       | true  |
    Then the action passes
    And the output "site" is "site"

  Scenario: A build with nothing to build gives no folder
    Given the repository holds the file "docs/notes.md" with "Not a feature file."
    When a push runs the action with:
      | ghg-version | 1.1.0 |
      | build       | true  |
      | input       | docs  |
    Then the action passes
    And the output "site" is ""
