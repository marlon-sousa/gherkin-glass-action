// Service: adds a version of the site to the branch Pages serves, as docs/BEHAVIOUR.md, rule 23, says.

import { posix } from "node:path";
import { addressOf } from "../policies/pages_source.ts";
import { buildIntoBranch, changeBranch, servedSiteOf, type PublishingPorts } from "./publishing.ts";
import type { SiteRequest } from "./reading_site_inputs.ts";

/** What publish is asked: the shared inputs, and the name of the version it adds. */
export interface VersionRequest extends SiteRequest {
  readonly versionName: string;
}

/**
 * Builds the version into folder of the branch, as ghg adds a version beside the others, pushes
 * it, and gives its address; publishes nothing when ghg has nothing to build.
 */
export async function publishVersion(ghg: string, request: VersionRequest, ports: PublishingPorts): Promise<void> {
  const served = await servedSiteOf(request, ports);
  const outcome = await changeBranch(
    request.branch,
    served,
    {
      message: `Publish the site's version ${request.versionName}`,
      apply: (checkout) =>
        buildIntoBranch(ghg, request, { checkout, folder: request.folder }, [`--version-name=${request.versionName}`], ports),
    },
    ports,
  );
  if (outcome === "left") {
    ports.runner.log("ghg read no feature file, so nothing is published.");
    ports.runner.setOutput("address", "");
    return;
  }
  const address = addressOf(served, posix.join(request.folder, request.versionName));
  if (outcome === "pushed") ports.runner.log(`The site is published on ${request.branch}, at ${address}.`);
  ports.runner.setOutput("address", address);
}
