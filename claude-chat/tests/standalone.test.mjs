// What a person with only Herdr and Claude Code gets: where the mod looks, and what the usage panel can show.
import test from "node:test";
import assert from "node:assert/strict";
import { configDirs, findSession } from "../mods/claude-chat/session.js";
import { folderTrusted, trustFiles } from "../mods/claude-chat/slash.js";
import { limitMeters, parseUsageText } from "../mods/claude-chat/usage-data.js";
import { isToggle } from "../mods/claude-chat/swap.js";

const HOME = "/Users/me";
const ID = "0f0e0d0c-0b0a-4a09-8877-665544332211";

test("sessions are looked for in Claude Code's default folder", async () => {
  assert.deepEqual(configDirs(HOME), [`${HOME}/.claude`]);
  const read = [];
  const readTextFile = async (path) => { read.push(path); return JSON.stringify({ pid: 90, sessionId: ID, cwd: "/work/lantern", updatedAt: 1 }); };
  const hc = async () => ({ code: 0, stdout: JSON.stringify({ foreground: { pid: 90 } }) });
  const s = await findSession({ hc, readTextFile, home: () => HOME }, "t2");
  assert.deepEqual(read, [`${HOME}/.claude/sessions/90.json`]);
  assert.equal(s.transcript, `${HOME}/.claude/projects/-work-lantern/${ID}.jsonl`);
});

test("trust is found in ~/.claude.json, where a default Claude Code keeps it", () => {
  assert.deepEqual(trustFiles(`${HOME}/.claude`, HOME), [`${HOME}/.claude/.claude.json`, `${HOME}/.claude.json`]);
  const files = { [`${HOME}/.claude.json`]: JSON.stringify({ projects: { "/work/lantern": { hasTrustDialogAccepted: true } } }) };
  const trusted = (folder) => trustFiles(`${HOME}/.claude`, HOME).some((path) => folderTrusted(files[path] ?? null, folder));
  assert.equal(trusted("/work/lantern"), true);
  assert.equal(trusted("/work/other"), false);
});

const USAGE = `You are currently using your subscription to power your Claude Code usage

Current session: 12% used · resets 4pm (Europe/Paris)
Current week (all models): 44% used · resets Sep 21 at 9am (Europe/Paris)
Current week (Fable): 96% used · resets Sep 21 at 9am (Europe/Paris)
Extra: 100% used

Last 24h · 3812 requests · 141 sessions
  68%  Start fresh when you switch tasks · run /clear
`;

test("the limits come from the /usage text, one bar for each line it has", () => {
  assert.deepEqual(limitMeters(parseUsageText(USAGE).limits), [
    { label: "Current session", used: 12, tone: "done", resets: "4pm" },
    { label: "Current week (all models)", used: 44, tone: "done", resets: "Sep 21 at 9am" },
    { label: "Current week (Fable)", used: 96, tone: "ansi3", resets: "Sep 21 at 9am" },
    { label: "Extra", used: 100, tone: "blocked", resets: null },
  ]);
});

test("no read, or a read with no limit lines, gives no bars", () => {
  assert.deepEqual(limitMeters(undefined), []);
  assert.deepEqual(limitMeters([]), []);
  assert.deepEqual(limitMeters(parseUsageText("Last 24h · 1 requests · 1 sessions\n").limits), []);
});

test("only a block that says so is the toggle", () => {
  assert.equal(isToggle({ role: "toggle" }), true);
  for (const props of [null, undefined, {}, { terminal: "t1" }, { role: "chat" }]) assert.equal(isToggle(props), false);
});

test("usage keeps its limits when the rest of the read fails", async () => {
  const { loadDetail } = await import("../mods/claude-chat/usage-data.js");
  const result = "Current week (all models): 13% used · resets Nov 11, 9pm (Europe/London)\n";
  const exec = async () => ({ code: 0, stdout: `${JSON.stringify({ type: "result", result })}\n` });
  await assert.rejects(loadDetail(exec, "/x", true), (e) => e.message === "no usage ranges in the text" && e.limits[0].used === 13);
});
