// Composition root: the publish action, publish/action.yml, wired to the runner.

import ghgOptions from "../ghg-options.json" with { type: "json" };
import { runPublish } from "./services/running_site_actions.ts";
import { siteActionPorts } from "./site_action_ports.ts";

void runPublish(ghgOptions, siteActionPorts());
