// Service: reads and checks every input of the root action before anything is downloaded.

import { orStop } from "../action_stop.ts";
import { buildArguments, buildAsked } from "../policies/build_arguments.ts";
import { configFileOf } from "../policies/report_paths.ts";
import { namedVersion } from "../policies/versions.ts";
import { platformOf, type Platform } from "../policies/targets.ts";
import type { Runner } from "../ports/runner.ts";

export interface InstallRequest {
  /** Undefined when ghg-version is empty. */
  readonly version: string | undefined;
  readonly platform: Platform;
  /** Undefined when there is no token, or when the workflow runs elsewhere than on github.com. */
  readonly releasesToken: string | undefined;
}

export interface ActionRequest {
  readonly install: InstallRequest;
  /** Undefined when build is not true. */
  readonly build: BuildRequest | undefined;
}

export interface BuildRequest {
  readonly buildArguments: readonly string[];
  /** Empty when the input is not given. */
  readonly input: string;
  /** Empty when the input is not given. */
  readonly frontPage: string;
  readonly configFile: string;
}

/** Throws an ActionStop with the first problem among the inputs. */
export function readRequest(runner: Runner): ActionRequest {
  const install = readInstallRequest(runner);
  const build = orStop(buildAsked(runner.input("build")));
  const passed = orStop(buildArguments((name) => runner.input(name)));
  return { install, build: build ? buildRequestOf(passed, (name) => runner.input(name)) : undefined };
}

/** Throws an ActionStop with the first problem among the inputs. */
export function readInstallRequest(runner: Runner): InstallRequest {
  const versionInput = runner.input("ghg-version");
  const version = versionInput === "" ? undefined : orStop(namedVersion(versionInput));
  const platform = orStop(platformOf(runner.system, runner.processor));
  const releasesToken = runner.onGitHubCom && runner.input("token") !== "" ? runner.input("token") : undefined;
  return { version, platform, releasesToken };
}

export function buildRequestOf(passed: readonly string[], inputOf: (name: string) => string): BuildRequest {
  return {
    buildArguments: passed,
    input: inputOf("input"),
    frontPage: inputOf("front-page"),
    configFile: configFileOf(inputOf("config")),
  };
}
