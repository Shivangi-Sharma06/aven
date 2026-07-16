import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { LocalSession } from "./types.js";

export function sessionPath(repositoryRoot: string) {
  return join(repositoryRoot, ".aven", "session.json");
}

export async function readSession(repositoryRoot: string): Promise<LocalSession | null> {
  try {
    return JSON.parse(await readFile(sessionPath(repositoryRoot), "utf8")) as LocalSession;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function writeSession(repositoryRoot: string, session: LocalSession) {
  const directory = join(repositoryRoot, ".aven");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const path = sessionPath(repositoryRoot);
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(session, null, 2)}\n`, { mode: 0o600 });
  await rename(temporaryPath, path);
}

export async function deleteSession(repositoryRoot: string) {
  await unlink(sessionPath(repositoryRoot)).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
  });
}
