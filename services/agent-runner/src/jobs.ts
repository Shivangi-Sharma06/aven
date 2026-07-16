import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { JobRecord } from "./types.ts";

type Journal = { version: 1; jobs: Record<string, JobRecord> };

export class JobStore {
  private journal: Journal = { version: 1, jobs: {} };
  private writeQueue = Promise.resolve();
  private readonly file: string;

  constructor(file: string) {
    this.file = file;
  }

  async open() {
    await mkdir(dirname(this.file), { recursive: true });
    try {
      this.journal = JSON.parse(await readFile(this.file, "utf8")) as Journal;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      await this.flush();
    }
  }

  get(key: string) {
    return this.journal.jobs[key];
  }

  async put(key: string, record: JobRecord) {
    this.journal.jobs[key] = record;
    await this.flush();
  }

  private flush() {
    this.writeQueue = this.writeQueue.then(async () => {
      const temporary = `${this.file}.tmp`;
      await writeFile(temporary, JSON.stringify(this.journal, null, 2), { mode: 0o600 });
      await rename(temporary, this.file);
    });
    return this.writeQueue;
  }
}
