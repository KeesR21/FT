import { readdir } from "fs/promises";
import path from "path";

export type AuditFileWalkOptions = {
  /** Skip very large files (bytes). */
  maxFileBytes?: number;
};

const DEFAULT_MAX = 800_000;

export async function walkSourceFiles(
  rootDir: string,
  filter: (absPath: string) => boolean,
  opts: AuditFileWalkOptions = {}
): Promise<string[]> {
  const max = opts.maxFileBytes ?? DEFAULT_MAX;
  const out: string[] = [];

  async function walk(dir: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === "node_modules" || e.name === ".next" || e.name === "dist" || e.name === ".git") continue;
        await walk(p);
      } else if (e.isFile() && filter(p)) {
        try {
          const st = await import("fs/promises").then((fs) => fs.stat(p));
          if (st.size <= max) out.push(p);
        } catch {
          /* skip */
        }
      }
    }
  }

  await walk(rootDir);
  return out;
}

export function normalizeProjectPath(cwd: string, abs: string): string {
  return path.relative(cwd, abs).split(path.sep).join("/");
}
