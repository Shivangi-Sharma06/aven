import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AvenConfig } from "./types.js";

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

export async function readConfig(repositoryRoot: string): Promise<AvenConfig | null> {
  try {
    return JSON.parse(await readFile(configPath(repositoryRoot), "utf8")) as AvenConfig;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function writeConfig(repositoryRoot: string, config: AvenConfig) {
  await mkdir(join(repositoryRoot, CONFIG_DIRECTORY), { recursive: true, mode: 0o700 });
  await writeAtomic(configPath(repositoryRoot), config);
}
