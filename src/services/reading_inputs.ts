// Service: reads and checks every input of the root action before anything is downloaded, as docs/BEHAVIOUR.md says.

import { orStop } from "../action_stop.ts";
import { buildArguments, buildAsked } from "../policies/build_arguments.ts";
import { configFileOf } from "../policies/report_paths.ts";
import { namedVersion } from "../policies/versions.ts";
import { platformOf, type Platform } from "../policies/targets.ts";
import type { Runner } from "../ports/runner.ts";

/** How ghg is installed, which every action asks for. */
export interface InstallRequest {
  /** The version ghg-version names, undefined when it is empty. */
  readonly version: string | undefined;
  readonly platform: Platform;
  /** The token sent to GitHub's API, undefined when there is none, or when the workflow runs elsewhere than on github.com. */
  readonly releasesToken: string | undefined;
}

/** What the root action is asked to do. */
export interface ActionRequest {
  readonly install: InstallRequest;
  /** The build to run, undefined when build is not true. */
  readonly build: BuildRequest | undefined;
}

/** The run of ghg build the action makes. */
export interface BuildRequest {
  /** The arguments after build. */
  readonly buildArguments: readonly string[];
  /** The inputs input and front-page, empty when they are not given. */
  readonly input: string;
  readonly frontPage: string;
  /** The configuration file ghg build reads. */
  readonly configFile: string;
}

/** The request the root action's inputs make, or an ActionStop with the first problem among them. */
export function readRequest(runner: Runner): ActionRequest {
  const install = readInstallRequest(runner);
  const build = orStop(buildAsked(runner.input("build")));
  const passed = orStop(buildArguments((name) => runner.input(name)));
  return { install, build: build ? buildRequestOf(passed, (name) => runner.input(name)) : undefined };
}

/** How the inputs ask ghg to be installed, or an ActionStop with the first problem among them. */
export function readInstallRequest(runner: Runner): InstallRequest {
  const versionInput = runner.input("ghg-version");
  const version = versionInput === "" ? undefined : orStop(namedVersion(versionInput));
  const platform = orStop(platformOf(runner.system, runner.processor));
  const releasesToken = runner.onGitHubCom && runner.input("token") !== "" ? runner.input("token") : undefined;
  return { version, platform, releasesToken };
}

/** The build of those arguments, with the inputs that say where ghg build finds its files. */
export function buildRequestOf(passed: readonly string[], inputOf: (name: string) => string): BuildRequest {
  return {
    buildArguments: passed,
    input: inputOf("input"),
    frontPage: inputOf("front-page"),
    configFile: configFileOf(inputOf("config")),
  };
}
