// Composition root: the publish action, publish/action.yml, wired to the runner.

import pairedGhg from "../paired-ghg.json" with { type: "json" };
import { majorOf } from "./policies/versions.ts";
import { runPublish } from "./services/running_site_actions.ts";
import { siteActionPorts } from "./site_action_ports.ts";

void runPublish(majorOf(pairedGhg.version), siteActionPorts());
