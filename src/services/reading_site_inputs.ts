// Service: reads and checks the inputs the publish and preview actions share, before anything is downloaded.

import { orStop } from "../action_stop.ts";
import { buildArguments } from "../policies/build_arguments.ts";
import { SITE_BUILD_INPUTS, siteInputsOf, type SiteInputs } from "../policies/site_inputs.ts";
import type { Runner } from "../ports/runner.ts";
import { buildRequestOf, readInstallRequest, type BuildRequest, type InstallRequest } from "./reading_inputs.ts";

export interface SiteRequest extends SiteInputs {
  readonly install: InstallRequest;
  readonly token: string;
  /** Before the action adds where it is written and how. */
  readonly build: BuildRequest;
  readonly keepInOutput: string;
  /** Empty when the input is not given. */
  readonly title: string;
}

/** Throws an ActionStop with the first problem among the inputs. */
export function readSiteRequest(runner: Runner): SiteRequest {
  const install = readInstallRequest(runner);
  const site = orStop(siteInputsOf((name) => runner.input(name)));
  const inputOf = (name: string) => (SITE_BUILD_INPUTS.includes(name) ? runner.input(name) : "");
  const passed = orStop(buildArguments(inputOf));
  const keepInOutput = runner.input("keep-in-output");
  const title = runner.input("title");
  return { ...site, install, token: runner.input("token"), build: buildRequestOf(passed, inputOf), keepInOutput, title };
}
