// Composition root: the preview action, preview/action.yml, wired to the runner.

import ghgOptions from "../ghg-options.json" with { type: "json" };
import { runPreview } from "./services/running_site_actions.ts";
import { siteActionPorts } from "./site_action_ports.ts";

void runPreview(ghgOptions, siteActionPorts());
