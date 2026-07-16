import chokidar from "chokidar";
import { createPrivacyFilter } from "./privacy.js";
import { relativeRepositoryPath } from "./git.js";
import { readSession, writeSession } from "./session.js";

const IDLE_AFTER_SECONDS = 10 * 60;

export async function runActivityWatcher(repositoryRoot: string) {
  const excluded = await createPrivacyFilter(repositoryRoot);
  let queue = Promise.resolve();
  const watcher = chokidar.watch(repositoryRoot, {
    ignoreInitial: true,
    persistent: true,
    ignored: (path) => {
      const relative = relativeRepositoryPath(repositoryRoot, path);
      return Boolean(relative && excluded(relative));
    },
  });

  watcher.on("all", () => {
    queue = queue.then(async () => {
      const session = await readSession(repositoryRoot);
      if (!session || session.status !== "active") return;
      const now = new Date();
      const elapsed = Math.max(0, Math.floor((now.getTime() - Date.parse(session.lastActivityAt)) / 1000));
      session.activeSeconds += Math.min(elapsed, IDLE_AFTER_SECONDS);
      session.idleSeconds += Math.max(0, elapsed - IDLE_AFTER_SECONDS);
      session.lastActivityAt = now.toISOString();
      session.activityEvents += 1;
      await writeSession(repositoryRoot, session);
    }).catch(() => undefined);
  });

  const stop = async () => {
    await queue;
    await watcher.close();
    process.exit(0);
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
  await new Promise(() => undefined);
}
