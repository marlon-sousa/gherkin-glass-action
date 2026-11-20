// Policy: the problem matcher of ghg build's report, for later steps, as docs/BEHAVIOUR.md, rule 10, says.

/** The matcher's owner, which the runner's remove-matcher command names. */
export const PROBLEM_MATCHER_OWNER = "ghg";

/** The matcher file the runner's add-matcher command reads, in the runner's format. */
export const PROBLEM_MATCHER = {
  problemMatcher: [
    {
      owner: PROBLEM_MATCHER_OWNER,
      severity: "error",
      pattern: [{ regexp: "^(.+?):(\\d+): (.+)$", file: 1, line: 2, message: 3 }],
    },
  ],
};
