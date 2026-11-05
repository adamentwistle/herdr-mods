// Finds the Claude Code session behind a terminal. No Herdr imports, so `node --test` can load this file.
const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Claude Code's config folder, under home. Someone who moved it with CLAUDE_CONFIG_DIR changes this line.
const CLAUDE_DIR = ".claude";

export function parseSession(text, dir) {
  try {
    const s = JSON.parse(text);
    if (!SESSION_ID.test(s?.sessionId ?? "")) return null;
    return { dir, sessionId: s.sessionId, startedAt: s.startedAt ?? 0 };
  } catch { return null; }
}

// What `hc get <terminal> --json` says, or null.
export async function terminalFacts({ hc }, terminal) {
  const got = await hc(["get", terminal, "--json"]).catch(() => null);
  if (got?.code !== 0) return null;
  try { return JSON.parse(got.stdout); } catch { return null; }
}

// `<config folder>/sessions/<pid>.json` names the session a Claude Code process is running. No file means no session.
export async function findSession({ readTextFile, home }, facts) {
  const pid = facts?.foreground?.pid;
  if (!Number.isInteger(pid) || pid <= 0) return null;
  const dir = `${home()}/${CLAUDE_DIR}`;
  const text = await readTextFile(`${dir}/sessions/${pid}.json`).catch(() => null);
  return text ? parseSession(text, dir) : null;
}
