import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AvenConfig, GithubRepoConfig } from "./types.js";

const CONFIG_DIRECTORY = ".aven";
const CONFIG_FILE = "config.json";

async function writeAtomic(path: string, value: unknown) {
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(temporaryPath, path);
  await chmod(path, 0o600);
}

export function configPath(repositoryRoot: string) {
  return join(repositoryRoot, CONFIG_DIRECTORY, CONFIG_FILE);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

export function isAvenConfig(value: unknown): value is AvenConfig {
  if (!value || typeof value !== "object") return false;
  const config = value as Partial<AvenConfig>;
  let dashboardUrlValid = false;
  if (isNonEmptyString(config.dashboardUrl)) {
    try {
      const url = new URL(config.dashboardUrl);
      dashboardUrlValid = url.protocol === "http:" || url.protocol === "https:";
    } catch {
      dashboardUrlValid = false;
    }
  }
  const githubValid = config.github === undefined || (
    Number.isSafeInteger(config.github.repositoryId) &&
    config.github.repositoryId > 0 &&
    isNonEmptyString(config.github.fullName) &&
    isNonEmptyString(config.github.htmlUrl) &&
    isNonEmptyString(config.github.cloneUrl) &&
    isNonEmptyString(config.github.sshUrl)
  );
  return config.version === 1 &&
    dashboardUrlValid &&
    isNonEmptyString(config.projectId) &&
    isNonEmptyString(config.contractId) &&
    typeof config.streamId === "string" &&
    /^\d+$/.test(config.streamId) &&
    isNonEmptyString(config.workerAddress) &&
    (config.asset === "USDC" || config.asset === "XLM") &&
    isNonEmptyString(config.token) &&
    (config.tokenExpiresAt === undefined || isIsoTimestamp(config.tokenExpiresAt)) &&
    githubValid &&
    (
      config.ratePerSecond === undefined ||
      (
        typeof config.ratePerSecond === "string" &&
        /^\d+(?:\.\d{1,7})?$/.test(config.ratePerSecond)
      )
    );
}

export async function readConfig(repositoryRoot: string): Promise<AvenConfig | null> {
  try {
    const raw = await readFile(configPath(repositoryRoot), "utf8");
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Corrupt config file — treat as absent.
      return null;
    }
    return isAvenConfig(parsed) ? parsed : null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function writeConfig(repositoryRoot: string, config: AvenConfig) {
  await mkdir(join(repositoryRoot, CONFIG_DIRECTORY), { recursive: true, mode: 0o700 });
  await writeAtomic(configPath(repositoryRoot), config);
}

export async function readGithubConfig(repositoryRoot: string): Promise<GithubRepoConfig | null> {
  return (await readConfig(repositoryRoot))?.github ?? null;
}
