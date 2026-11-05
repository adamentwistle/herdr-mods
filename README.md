# Herdr mods

Three mods for the [Herdr](https://github.com/ogulcancelik/herdr) desktop app, split out of [Orchi](https://github.com/adamentwistle/orchi-build) so they work on their own. Each folder is one gallery entry, with a `RECIPE.md`, a `preview.png` and the mod.

| Mod | What it does |
| --- | --- |
| [`space-agents`](space-agents/RECIPE.md) | One sidebar list: each space folds, with its agents under it by status, and anyone who needs you at the top |
| [`herd`](herd/RECIPE.md) | A side panel with a map of everything a session started, and a row per agent saying what it's doing |
| [`claude-chat`](claude-chat/RECIPE.md) | A chat view of a live Claude Code session, swapped with its terminal by one key |

All three are built and run on macOS. Ask your agent to add one from [herdr.dev/mods](https://herdr.dev/mods), or point it at the folder here. It reads the recipe and every file first.

The code is MIT, except where `NOTICE.md` says otherwise. These copies follow the mods in Orchi, and `scripts/check-drift.py` lists where they differ from it.
