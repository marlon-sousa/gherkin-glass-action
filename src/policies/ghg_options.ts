// Policy: the release of ghg each option of ghg build needs, as ghg-options.json gives it.

import { isOlder } from "./versions.ts";

export interface GhgOptions {
  /** The release the action's checks install. */
  readonly tested: string;
  /** Each option, without its dashes, with the first release of ghg that has it. */
  readonly since: Readonly<Record<string, string>>;
}

export interface OptionsPassed {
  /** The options the workflow's inputs give ghg build. */
  readonly byInputs: readonly string[];
  /** The options the action gives ghg build itself. */
  readonly byAction: readonly string[];
}

/** The sentences the action stops with, one for each reason; empty when the version has every option passed. */
export function tooOldFor(version: string, passed: OptionsPassed, options: GhgOptions): readonly string[] {
  const tooNew = (option: string) => {
    const release = options.since[option];
    return release !== undefined && isOlder(version, release) ? [{ option, release }] : [];
  };
  const newestOfAction = passed.byAction
    .flatMap(tooNew)
    .map(({ release }) => release)
    .reduce<string | undefined>((newest, release) => (newest === undefined || isOlder(newest, release) ? release : newest), undefined);
  const ofAction = newestOfAction === undefined ? [] : [`The action builds with ghg ${newestOfAction} or newer, not ${version}.`];
  const ofInputs = passed.byInputs.flatMap(tooNew).map(({ option, release }) => `${option} needs ghg ${release} or newer, not ${version}.`);
  return [...ofAction, ...ofInputs];
}

/** The option of each argument, without its dashes, such as title for --title=Shop. */
export function optionsOf(buildArguments: readonly string[]): readonly string[] {
  return [...new Set(buildArguments.flatMap((argument) => /^--([a-z][a-z-]*)/.exec(argument)?.[1] ?? []))];
}
