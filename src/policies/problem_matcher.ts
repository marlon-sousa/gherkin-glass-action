// Policy: the problem matcher of ghg build's report, for later steps.

export const PROBLEM_MATCHER_OWNER = "ghg";

export const PROBLEM_MATCHER = {
  problemMatcher: [
    {
      owner: PROBLEM_MATCHER_OWNER,
      severity: "error",
      pattern: [{ regexp: "^(.+?):(\\d+): (.+)$", file: 1, line: 2, message: 3 }],
    },
  ],
};
