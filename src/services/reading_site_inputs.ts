// Service: reads and checks the inputs the publish and preview actions share, before anything is downloaded, as docs/BEHAVIOUR.md, rule 19, says.

import { orStop } from "../action_stop.ts";
import { buildArguments } from "../policies/build_arguments.ts";
import { SITE_BUILD_INPUTS, siteInputsOf, type SiteInputs } from "../policies/site_inputs.ts";
import type { Runner } from "../ports/runner.ts";
import { buildRequestOf, readInstallRequest, type BuildRequest, type InstallRequest } from "./reading_inputs.ts";

/** What the publish or preview action is asked to do, before its own inputs. */
export interface SiteRequest extends SiteInputs {
  readonly install: InstallRequest;
  /** The token that reads Pages, pushes the branch and writes the comment, sent to the workflow's own server. */
  readonly token: string;
  /** The build of what is published, before the action adds where it is written and how. */
  readonly build: BuildRequest;
  /** The input keep-in-output, which the action passes after the files Pages reads. */
  readonly keepInOutput: string;
  /** The input title, empty when it is not given, which each action passes itself. */
  readonly title: string;
}

/** The request the shared inputs make, or an ActionStop with the first problem among them. */
export function readSiteRequest(runner: Runner): SiteRequest {
  const install = readInstallRequest(runner);
  const site = orStop(siteInputsOf((name) => runner.input(name)));
  // The action chooses the other options of ghg build itself.
  const inputOf = (name: string) => (SITE_BUILD_INPUTS.includes(name) ? runner.input(name) : "");
  const passed = orStop(buildArguments(inputOf));
  const keepInOutput = runner.input("keep-in-output");
  const title = runner.input("title");
  return { ...site, install, token: runner.input("token"), build: buildRequestOf(passed, inputOf), keepInOutput, title };
}
