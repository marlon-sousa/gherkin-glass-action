Feature: Installing ghg
  The action installs ghg on the runner, and puts it on the PATH of the job's later steps
  (docs/BEHAVIOUR.md, "Installing").

  @rule-1 @rule-4
  Scenario: The release named is installed, and a later step runs it
    When a push runs the action with:
      | ghg-version | 1.1.0 |
    And a later step runs "ghg --version"
    Then the action passes
    And the log says "ghg 1.1.0 is installed."
    And the log says "ghg 1.1.0"

  @rule-2
  Scenario: A version that is not one stops the action
    When a push runs the action with:
      | ghg-version | latest |
    Then the action fails with "ghg-version must be a version of ghg, such as 1.2.0."

  @rule-2
  Scenario: Building with a ghg older than 1.1.0 stops the action before it is downloaded
    When a push runs the action with:
      | ghg-version | 1.0.0 |
      | build       | true  |
    Then the action fails with "The action builds with ghg 1.1.0 or newer, not 1.0.0."
    And the log does not say "ghg 1.0.0 is installed."

  @rule-6
  Scenario: The ghg installed is kept in the runner's tool cache
    When a push runs the action with:
      | ghg-version | 1.1.0 |
    And a later step runs "test -n \"$(ls \"$RUNNER_TOOL_CACHE\"/ghg/1.1.0/*/)\" && echo ghg is in the tool cache"
    Then the action passes
    And the log says "ghg is in the tool cache"
