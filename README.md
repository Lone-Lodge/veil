# veil

A UI framework where the program says what it means and veil decides what it
looks like. You build a document of named nodes; a theme says how a role is
drawn; veil measures it, places it, and hands out a display list. Nothing in
veil knows about a window, a GPU or a DOM.

The same document runs three ways today:

| target | painter | what it costs |
|---|---|---|
| native | atlas / d3d12 | a window |
| a tab | one WebGL draw call | 224 kB of wasm, no server, no framework |
| anywhere | JSON over HTTP | a round trip a frame |

## The shape of it

```
SemanticDocument   nodes, flat, each naming its children by index
      +
Theme              how a role is drawn, and in which state
      |
   measure         how big each node wants to be
      |
   place           where each one ended up          -> [Measured]
      |
   paint           what to draw, in order           -> DisplayList
      |
  a painter        the card, canvas, d3d12, JSON
```

A **Frame** carries all of it, so the next frame can be told from the last one
instead of built from nothing.

## The smallest app

```orion
use veil_document
use veil_resolver
use veil_theme
use veil_page

define screen() -> SemanticDocument:
    a = append([], n("text", [p("text", "Hej")], []))
    b = append(a, n("panel", [p("pad", "16")], [top(a)]))
    SemanticDocument{root: top(b), nodes: b}

public define frame() -> number:
    room = Rect{x: 0.0, y: 0.0, wide: 800.0, high: 600.0}
    here = first_frame(screen(), default_theme(), font_body(), room)
    pack_page(here.list)
```

`first_frame` builds one from nothing. `next_frame(before, ...)` builds one
from the frame before and is six times cheaper, because it re-measures and
re-places only the nodes that changed.

`pack_page` is the seam out: the whole frame as two blocks of numbers and one
call. `display_list_json` is the same frame as JSON when the renderer is
somewhere else.

## A theme

`default_theme()` draws: six roles in light, `dark_theme()` the same six
inverted. It is a floor, not a design system, so an app can put a document on
the screen before it has decided what it looks like.

```orion
styled(name, pad, gap, fg, bg, way, radius, size)   a rule
dressed(...)                                       the same plus border and shadow
```

A rule named `button:lit` is the `button` rule while that node is in state
`lit`. A theme only spells out the states it changes; the rest fall back. A
role with no rule draws nothing at all, which is veil saying it does not know
that word.

## What a node is

```orion
n(role, props, children)     a node
p(key, content)              one property
top(nodes)                   the index of the one just appended
```

Everything is a property, and a property is text. `p("pad", "16")`,
`p("text", "Hej")`, `p("do", "save")`, `p("state", "lit")`. The theme reads
roles and states; the resolver reads layout properties. A property nobody
reads costs nothing.

Layout properties the resolver knows: `w`, `h`, `pad`, `gap`, `fill`, `grow`,
`layout` (`flow`), `align`, `justify`, `wrap`, `radius`, `scroll`, `clip`.
Painting: `text`, `icon`, `image`, `nine`, `slice`, `shape`, `state`.
Interaction: `do` (what a press means), `caret`, `anchor`.

## Answering a pointer

```orion
pick_placed(doc, theme, placed, x, y)    what is under the pointer, by `do` name
near_toward(doc, placed, from, dx, dy)   what is that way from here, for arrows
reading_order(doc, placed)               tab order, out of the layout
```

Nobody keeps a list of what is beside what: a screen that grew a control
yesterday is walked today.

## What it costs

Measured in a tab, 1422x1249, 147 draw commands, a page with one meter
animating:

```
veil, a frame told from the last one   0.145 ms
the seam packing it as numbers         0.065
the page reading it into instances     0.080
the draw call                          0.035
                                       -------
                                       0.33 ms
```

A still screen costs **nothing**: the page asks `restless()` first, and a
screen where nothing is moving is not built at all. Of the 147 commands, 139
are handed over from the frame before rather than worked out again.

## Running it

```
bash tools/gates.sh
```

203 checks, then the wasm target: it builds the gallery, validates the module,
and checks that every import it asks for is one the page supplies. The wasm
half is in the gate because it once rotted through a whole compiler migration
while nothing built it.

The gallery itself:

```
bash examples/wasm_gallery/build.sh
python -m http.server 7801 --directory examples/wasm_gallery
```

Seven pages: controls, layout, content, docking, a game HUD, a canvas, theming.
`?gpu=0` swaps the card for the canvas2d reader, which is also what happens by
itself on a machine without webgl2.

## What is not done

- **Painting is not incremental.** Measuring and placing skip what did not
  change; painting and packing still walk every node. The page makes up for it
  by keeping the instances it already built, but veil could stop earlier.
- **A gradient is two stops, vertical.** The shader lerps between them.
- **`blend: add` is ignored.** A tint multiplies; an additive picture draws as
  a normal one.
- **The picture sheet is 1024x1024.** A picture too big for it is skipped
  rather than drawn wrong. Fine for icons and panels, not for photographs.
- **Text is placed letter by letter, no kerning.** That is deliberate: veil
  measures a line by adding advances, so it draws it the same way and the two
  can never disagree. It differs from a browser shaping the same run.
