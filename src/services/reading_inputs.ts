// Service: reads and checks every input before anything is downloaded, as docs/BEHAVIOUR.md says.

import { orStop } from "../action_stop.ts";
import { buildArguments, buildAsked } from "../policies/build_arguments.ts";
import { configFileOf } from "../policies/report_paths.ts";
import { namedVersion } from "../policies/versions.ts";
import { publishInputsOf, type PublishInputs } from "../policies/publish_request.ts";
import { publishTargetOf, type PublishTarget } from "../policies/workflow_event.ts";
import { platformOf, type Platform } from "../policies/targets.ts";
import type { Runner } from "../ports/runner.ts";

/** What the action is asked to do. */
export interface ActionRequest {
  /** The version ghg-version names, undefined when it is empty. */
  readonly version: string | undefined;
  readonly platform: Platform;
  /** The token sent to GitHub's API, undefined when there is none, or when the workflow runs elsewhere than on github.com. */
  readonly token: string | undefined;
  /** The build to run, undefined when build is not true. */
  readonly build: BuildRequest | undefined;
  /** What to publish, undefined when publish is not true. */
  readonly publish: PublishRequest | undefined;
}

/** What the action publishes, and on which branch. */
export interface PublishRequest extends PublishInputs {
  readonly target: PublishTarget;
  /** The token that reads Pages, pushes the branch and writes the comment, sent to the workflow's own server. */
  readonly token: string;
  /** The build of what is published, before the action adds where it is written and how. */
  readonly build: BuildRequest;
}

/** The run of ghg build the action makes. */
export interface BuildRequest {
  /** The arguments after build. */
  readonly buildArguments: readonly string[];
  /** The input input, empty when it is not given. */
  readonly input: string;
  /** The input front-page, empty when it is not given. */
  readonly frontPage: string;
  /** The configuration file ghg build reads. */
  readonly configFile: string;
}

/** The request the inputs make, or an ActionStop with the first problem among them. */
export function readRequest(runner: Runner): ActionRequest {
  const versionInput = runner.input("ghg-version");
  const version = versionInput === "" ? undefined : orStop(namedVersion(versionInput));
  const build = orStop(buildAsked(runner.input("build")));
  const passed = orStop(buildArguments((name) => runner.input(name)));
  const platform = orStop(platformOf(runner.system, runner.processor));
  const token = runner.onGitHubCom && runner.input("token") !== "" ? runner.input("token") : undefined;
  const publishInputs = orStop(publishInputsOf((name) => runner.input(name)));
  const buildOf = (buildArguments: readonly string[]): BuildRequest => ({
    buildArguments,
    input: runner.input("input"),
    frontPage: runner.input("front-page"),
    configFile: configFileOf(runner.input("config")),
  });
  return {
    version,
    platform,
    token,
    build: build ? buildOf(passed) : undefined,
    publish:
      publishInputs === undefined
        ? undefined
        : {
            ...publishInputs,
            target: orStop(publishTargetOf(runner.workflowEvent(), publishInputs, runner.input("version-name"))),
            token: runner.input("token"),
            // The action names the version itself, and ghg refuses --version-name given twice, or
            // with --preview (gherkin-glass's rules 19 and 212).
            build: buildOf(orStop(buildArguments((name) => (name === "version-name" ? "" : runner.input(name))))),
          },
  };
}
