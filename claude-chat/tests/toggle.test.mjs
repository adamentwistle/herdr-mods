// Runs the real main.js and toggle.js against stand-ins for the app's modules. Needs Node 22.15 or later, for registerHooks.
// `node --test tests/*.test.mjs` from the folder that holds `mods/`.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { registerHooks } from "node:module";

const MOD = new URL("../mods/claude-chat/", import.meta.url);

// What each mod file takes from the app, so every name has a stand-in.
const names = { "gpui-kit": new Set(), "gpui-base": new Set(), herdr: new Set() };
for (const file of readdirSync(MOD).filter((f) => f.endsWith(".js"))) {
  for (const m of readFileSync(new URL(file, MOD), "utf8").matchAll(/import \{([^}]*)\} from "(gpui-kit|gpui-base|herdr)"/g)) {
    for (const name of m[1].split(",")) names[m[2]].add(name.trim());
  }
}

// Answers anything: a builder chain, a state object, a theme.
const any = new Proxy(function () {}, {
  get: (_t, key) => (key === "then" ? undefined : key === Symbol.toPrimitive ? () => "" : any),
  apply: () => any,
  construct: () => any,
});

const app = { fns: {} };
globalThis.standIn = (name) => new Proxy(function () {}, {
  get: (_t, key) => (key === "then" ? undefined : any),
  apply: (_t, _self, args) => (name in app.fns ? app.fns[name](...args) : any),
});

registerHooks({
  resolve: (spec, context, next) => (spec in names ? { url: `standin:${spec}`, shortCircuit: true } : next(spec, context)),
  load: (url, context, next) => {
    if (!url.startsWith("standin:")) return next(url, context);
    const lines = [...names[url.slice("standin:".length)]].map((name) => (name === "View" ? "export class View {}" : `export const ${name} = globalThis.standIn(${JSON.stringify(name)});`));
    return { format: "module", source: lines.join("\n"), shortCircuit: true };
  },
});

const { default: Chat } = await import(new URL("main.js", MOD));

const term = (over = {}) => ({ pane: "p1", terminal: "t1", tab: "a", app: "claude-code", focused: true, zoomed: false, ...over });
const chat = (over = {}) => ({ pane: "p2", terminal: null, mod: "claude-chat", tab: "a", app: null, focused: false, zoomed: false, ...over });

// A window: the panes in it, what's been run, and the copies of the mod. `key` reaches every copy, as a key does.
function window(list) {
  const w = { list, runs: [], shared: {}, waiting: [], timers: 0 };
  app.fns = {
    panes: () => w.list, spaces: () => [], terminals: () => [], props: () => w.props,
    run: (name, args) => { w.runs.push([name, args]); },
    shared: (key) => w.shared[key], setShared: (key, value) => { w.shared[key] = value; },
    nextCommand: () => new Promise((resolve) => w.waiting.push(resolve)),
    home: () => "/Users/me", appHome: () => "/Users/me/.config/herdr-app",
    readTextFile: async () => null, watchFolder: () => new Promise(() => {}),
    hc: async () => ({ code: 1, stdout: "" }), exec: async () => ({ code: 1, stdout: "" }),
  };
  w.copy = (props) => {
    const view = new Chat();
    const cx = { timer: { every: () => { w.timers += 1; }, after: () => {} }, spawn: (f) => f(cx), notify: () => {}, bind_keys: () => {}, focus_handle: () => any, sleep: async () => {} };
    w.props = props;
    view.init(props, cx);
    return view;
  };
  w.key = async (command) => {
    for (const resolve of w.waiting.splice(0)) resolve(command);
    await new Promise((resolve) => setImmediate(resolve));
  };
  return w;
}

const TOGGLE = { role: "toggle" };

test("with chat panes open the key still swaps once, because only the toggle acts", async () => {
  const w = window([term()]);
  w.copy(TOGGLE); w.copy({ terminal: "t8" }); w.copy({ terminal: "t9" });
  await w.key("swap");
  assert.deepEqual(w.runs, [["pane.split", { direction: "right", pane: "p1", mod: "claude-chat", props: { terminal: "t1" } }]]);
});

test("a chat pane with no toggle does nothing with the key", async () => {
  const w = window([term()]);
  w.copy({ terminal: "t1" });
  await w.key("swap");
  assert.deepEqual(w.runs, []);
});

test("the toggle keeps listening after a press", async () => {
  const w = window([term({ focused: false, zoomed: false }), chat({ focused: true, zoomed: true })]);
  w.shared["chatpane.pairs"] = { p2: "t1" };
  w.copy(TOGGLE);
  await w.key("swap");
  await w.key("swap");
  assert.equal(w.runs.filter(([name]) => name === "pane.focus").length, 2);
});

test("a first press splits, and the render that finds the new pane pairs it, zooms it and focuses it", async () => {
  const w = window([term()]);
  const toggle = w.copy(TOGGLE);
  await w.key("swap");
  w.runs.length = 0;
  w.list = [term(), chat()];
  toggle.render();
  assert.deepEqual(w.shared["chatpane.pairs"], { p2: "t1" });
  assert.deepEqual(w.runs, [["pane.zoom", { pane: "p2" }], ["pane.focus", { pane: "p2" }]]);
});

test("a second key before the split shows doesn't split again", async () => {
  const w = window([term()]);
  w.copy(TOGGLE);
  await w.key("swap");
  await w.key("swap");
  assert.equal(w.runs.filter(([name]) => name === "pane.split").length, 1);
});

test("the toggle does none of a chat pane's work", async () => {
  const w = window([term()]);
  const toggle = w.copy(TOGGLE);
  assert.equal(w.timers, 0);
  assert.equal(toggle.composer, undefined);
  assert.equal(await toggle.close(), undefined);
  w.copy({ terminal: "t1" });
  assert.ok(w.timers > 0, "a chat pane does run its timers");
});

test("a pane that isn't Claude Code gives the toggle nothing to do", async () => {
  const w = window([term({ app: null })]);
  w.copy(TOGGLE);
  await w.key("swap");
  assert.deepEqual(w.runs, []);
});
