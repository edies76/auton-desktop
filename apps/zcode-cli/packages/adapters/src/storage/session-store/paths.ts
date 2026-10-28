import { homedir } from "node:os";
import { join } from "node:path";

const ZCODE_HOME = process.env.AUTON_STORAGE_DIR?.trim() || process.env.ZCODE_STORAGE_DIR?.trim() || join(homedir(), ".zcode");

export function getDefaultSessionDbPath(): string {
  return join(ZCODE_HOME, "cli", "db", "db.sqlite");
}
