# Contributing

## Build and prove it

veil is written in Orion. Install the
[orion](https://github.com/Lone-Lodge/orion) toolchain; veil needs nothing
else.

```sh
bash tools/gates.sh              # 247 checks, the smallest-app gate, the wasm target
python tools/guide.py --check    # the page still matches README.md
```

The wasm half is in the gate because it rotted once: the backend fell behind
the native one for a whole `number` migration and nothing noticed, because
nothing built it. A framework that says it runs in a tab has to build for a tab
every time.

## The shape of a change

- **A behaviour needs a check.** `src/main.or` is the suite; a row there is one
  sentence about what is true.
- **The README is the documentation and the page.** `docs/index.html` is
  generated from it, so edit the README and run `python tools/guide.py`.
- **Nothing in veil knows about a window, a GPU or a DOM.** A change that needs
  one belongs in a painter, not in the resolver.
- **One subject line, lower case, saying what is now true.**

## Sending a change

Two branches, and that is all: **`dev`** is where work lands, **`main`** is what
has been released. Open your pull request against `dev` - it is the default
branch, so a fork targets it without you having to think about it.

You cannot push here, and that is the point: fork, branch off `dev`, and open a
pull request. CI runs the gates on every one, on Linux and Windows, and `dev`
will not take a merge until they are green. Nothing lands unread and unproven.

`main` only moves for a release, and only by the maintainer.

What gets merged: one thing at a time, small enough to read in a sitting, with
the gate that proves it. What does not: a rewrite nobody asked for, a change
with no way to tell whether it works, or a diff that mixes a fix with a
reformat. If you are unsure whether something is wanted, open an issue first
and ask - that costs you nothing and saves you an afternoon.

## Where things live

```
orbs/veil_document   the tree of named nodes
orbs/veil_theme      how a role is drawn, and in which state
orbs/veil_measure    how big each node wants to be
orbs/veil_resolver   place, paint, pick
orbs/veil_page       a display list straight into a page
orbs/veil_web        the same list as JSON
gates/               projects that prove veil is usable from outside
examples/            the wasm gallery and the web demo
```
