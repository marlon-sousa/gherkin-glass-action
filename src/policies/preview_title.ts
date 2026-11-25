// Policy: the title of a pull request's preview.

import { parse } from "smol-toml";

// ghg's title for a site that names none.
const DEFAULT_TITLE = "Feature files";

export function previewTitleOf(titleInput: string, configText: string | undefined, pullRequest: number): string {
  const siteTitle = titleInput !== "" ? titleInput : (configuredTitle(configText) ?? DEFAULT_TITLE);
  return `${siteTitle}, pull request #${pullRequest}`;
}

// Undefined for a file or a title ghg reports as a problem itself.
function configuredTitle(configText: string | undefined): string | undefined {
  if (configText === undefined) return undefined;
  try {
    const { title } = parse(configText);
    return typeof title === "string" && title !== "" ? title : undefined;
  } catch {
    return undefined;
  }
}
