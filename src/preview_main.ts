// Composition root: the preview action, preview/action.yml, wired to the runner.

import pairedGhg from "../paired-ghg.json" with { type: "json" };
import { majorOf } from "./policies/versions.ts";
import { runPreview } from "./services/running_site_actions.ts";
import { siteActionPorts } from "./site_action_ports.ts";

void runPreview(majorOf(pairedGhg.version), siteActionPorts());
