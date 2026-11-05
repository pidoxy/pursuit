import "server-only";
import fs from "node:fs";
import path from "node:path";
import { db, DATA_DIR } from "./db";

const KEEP = Number(process.env.BACKUP_KEEP_DAYS ?? 7);

/** One consistent SQLite snapshot per day in DATA_DIR/backups, keeping the last 7. */
export async function dailyBackup(now = new Date()): Promise<string | null> {
  if (process.env.DISABLE_BACKUPS === "true") return null;
  const dir = path.join(DATA_DIR, "backups");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `pursuit-${now.toISOString().slice(0, 10)}.db`);
  let made: string | null = null;
  if (!fs.existsSync(file)) {
    await db.backup(`${file}.tmp`);
    fs.renameSync(`${file}.tmp`, file);
    made = file;
  }
  const old = fs.readdirSync(dir).filter((f) => /^pursuit-\d{4}-\d{2}-\d{2}\.db$/.test(f)).sort().reverse().slice(KEEP);
  for (const f of old) fs.rmSync(path.join(dir, f), { force: true });
  return made;
}
