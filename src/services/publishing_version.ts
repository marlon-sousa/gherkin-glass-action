// Service: adds a version of the site to the branch Pages serves.

import { posix } from "node:path";
import { addressOf } from "../policies/pages_source.ts";
import { buildIntoBranch, changeBranch, servedSiteOf, type PublishingPorts } from "./publishing.ts";
import type { SiteRequest } from "./reading_site_inputs.ts";

export interface VersionRequest extends SiteRequest {
  readonly versionName: string;
}

export async function publishVersion(ghg: string, request: VersionRequest, ports: PublishingPorts): Promise<void> {
  const served = await servedSiteOf(request, ports);
  const outcome = await changeBranch(
    request.branch,
    served,
    {
      message: `Publish the site's version ${request.versionName}`,
      apply: (checkout) => buildIntoBranch(ghg, request, { checkout, folder: request.folder }, versionArguments(request), ports),
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

function versionArguments(request: VersionRequest): readonly string[] {
  const title = request.title === "" ? [] : [`--title=${request.title}`];
  return [...title, `--version-name=${request.versionName}`];
}
