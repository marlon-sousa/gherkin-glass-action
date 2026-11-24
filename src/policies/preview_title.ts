// Policy: the title of a pull request's preview, as docs/BEHAVIOUR.md, rule 30, says.

import { parse } from "smol-toml";

// gherkin-glass's rule 81: a site with no title, from --title or the configuration's title.
const DEFAULT_TITLE = "Feature files";

/**
 * The preview's title: the site's title as ghg would give it, the input title, else the
 * configuration file's title, else ghg's default, then a comma, a space and the pull request.
 */
export function previewTitleOf(titleInput: string, configText: string | undefined, pullRequest: number): string {
  const siteTitle = titleInput !== "" ? titleInput : (configuredTitle(configText) ?? DEFAULT_TITLE);
  return `${siteTitle}, pull request #${pullRequest}`;
}

// The key title. A file ghg cannot read, or a title that is not text or is empty, reports its own
// problem when ghg reads the file (gherkin-glass's rule 26), so the action does not rely on it.
function configuredTitle(configText: string | undefined): string | undefined {
  if (configText === undefined) return undefined;
  try {
    const { title } = parse(configText);
    return typeof title === "string" && title !== "" ? title : undefined;
  } catch {
    return undefined;
  }
}
