# Git tips for this repo

Small workflow notes that don't belong in any single feature doc.

## Partially staging a brand-new (untracked) file

Git GUIs stage line/hunk selections by diffing your working file against what's
already in the index — for a genuinely **untracked** file there's nothing in the
index yet, so most tools (VS Code's Source Control panel, the classic `git gui`
Tcl/Tk tool) fall back to "stage the whole file," with no way to pick lines.

**Fix — give it an empty tracked baseline first:**

```bash
git add -N "path/to/new-file.tsx"   # --intent-to-add
```

This adds the file to the index with **zero content**, so git now treats the
entire file as an "added" diff against that empty baseline. That's enough for
line/hunk-level tools to work normally:

- **VS Code**: the file moves from "Untracked" to "Changes" in Source Control.
  Click the refresh icon if the gutter decorations don't appear immediately.
  Select lines in the editor → right-click → **"Stage Selected Ranges"** (or a
  hunk's **+** icon in the gutter).
- **`git gui`** (the Tcl/Tk tool bundled with Git): click **Rescan**, then
  select lines in the diff pane → right-click → **"Stage Lines"**.
- **CLI**: `git add -p "path/to/new-file.tsx"` — for each hunk: `y` stage,
  `n` skip, `s` split into smaller hunks, `e` hand-edit the patch (for
  line-level control a split can't reach), `q` quit.
- **[git-cola](https://git-cola.github.io/)** (`brew install git-cola`, run as
  `git cola` from the repo root) handles the intent-to-add step internally and
  supports selecting individual lines (not just hunks) directly — generally
  the smoothest option of the four for this specific case.

### ⚠️ Don't discard/revert the file while it's in this state

Once a file has an empty intent-to-add baseline, **"Discard Changes" / "Revert"
in an IDE, or `git checkout -- <file>` from the terminal, resets the working
file back to that empty baseline** — i.e. it wipes your uncommitted work back
to a 0-byte file. This isn't hypothetical: it happened in this repo. Until
you're done picking hunks, only touch the file via `git add -p` / the GUI's
staging actions, or `git restore --staged "<file>"` to back out the
intent-to-add cleanly (unstages only — never touches working-tree content,
unlike a discard/revert).

## Quoting paths under `(tabs)/`

`(` and `)` are extended-glob special characters in zsh, so an unquoted path
like `src/app/(tabs)/memory-words.tsx` fails with `no matches found`. Always
quote (or escape) paths under `(tabs)/` in shell commands:

```bash
git add "src/app/(tabs)/memory-words.tsx"
# or
git add src/app/\(tabs\)/memory-words.tsx
```
