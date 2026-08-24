# veil

A UI framework where the program says what it means and veil decides what it
looks like. You build a document of named nodes; a theme says how a role is
drawn; veil measures it, places it, and hands out a display list. Nothing in
veil knows about a window, a GPU or a DOM.

The same document runs three ways today:

| target | painter | what it costs |
|---|---|---|
| native | atlas / d3d12 | a window |
| a tab | one WebGL draw call | 244 kB of wasm, no server, no framework |
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
`layout` (`flow`), `align`, `justify`, `wrap`, `radius`, `scroll_y`,
`scrollbar`, `clip`.
Painting: `text`, `icon`, `image`, `nine`, `slice`, `shape`, `state`.
Interaction: `do` (what a press means), `caret`, `anchor`, `zone`.
Text on its way in: `compose_from`, `compose_to`.
A list that is mostly not there: `rows`, `row_h`, `from`.
Something hanging in the world: `at_x`, `at_y`, `pin`, `world`, `order`.

## A list of twenty-four thousand things

```orion
win = row_window(24000, 26, 150, at)
n("well", [p("rows", "24000"), p("row_h", "26"), p("from", "{win.first}"),
           p("h", "150"), p("clip", "1"), p("scrollbar", "1"),
           p("scroll_y", "{at}")], the_twelve)
```

The box says how many rows there **are**, how tall one is, and which one the
first of the ones you handed over is. veil puts it where its index belongs and
reports the whole list's height, so the scroll and the scrollbar tell the
truth about a list that is mostly not there. Twenty-four thousand rows cost
**eight draw commands**.

Say `row_h` and the arithmetic is exact. Leave it out - a chat log whose lines
wrap to different heights cannot know it in advance - and the length of the
list is the **average of the rows in hand**: a guess that gets better as you
go and is exact once you have been everywhere. What drifts is the scrollbar
thumb, by a little, in places you have not been yet.

The same idea one dimension further is a bag: `layout: grid` with `cols`, and
the items land in the cells their own indices name. Ten thousand slots four
across, showing forty, is forty nodes and one number.

```orion
n("bag", [p("layout", "grid"), p("cols", "8"), p("rows", "10000"),
          p("row_h", "48"), p("from", "{win.first * 8}"), p("clip", "1"),
          p("scrollbar", "1"), p("scroll_y", "{at}")], the_forty)
```

A gradient is any number of stops in either direction - `grad:0a0a0a:2a2a2a`
down the box, `grad:across:f00:0f0:00f` along it. It is baked onto the picture
sheet as a strip and drawn as a picture, which is why the count of stops costs
nothing.

## Something hanging in the world

```orion
n("plate", [p("at_x", "{sx}"), p("at_y", "{sy}"), p("pin", "above"),
            p("world", "1"), p("order", "{far - dist}")], name_and_bar)
```

The game projects - veil is not a camera - and hands over a screen point.
`pin` says how the box sits **on** the point rather than starting at it;
`world: 1` says the point is real, so a plate whose owner walked behind you is
gone rather than pinned to the edge; `order` is the depth. A thousand
nameplates of which sixty are in front of you: 61 draw commands, and a told
frame of 1 ms.

## Answering a pointer

```orion
pick_placed(doc, theme, placed, x, y)    what is under the pointer, by `do` name
near_toward(doc, placed, from, dx, dy)   what is that way from here, for arrows
reading_order(doc, placed)               tab order, out of the layout
```

Nobody keeps a list of what is beside what: a screen that grew a control
yesterday is walked today.

## Zones, for a screen with panels on it

A game screen is eight panels, not one long ring. `p("zone", "bags")` on a
panel and everything in it is the bags. The ring **moving** is zone-bound - an
arrow or a stick means "the next thing over there", and there is nothing over
there once the panel ends. Tab is not: it means "the next thing on this
screen", as it always has.

```orion
zone_of(doc, name)                     which panel something stands in
zone_names(doc, placed)                the panels, in reading order
reading_order_in(doc, placed, zone)    the ring inside one panel
scroller_of(doc, name)                 which scrolling box something is in
scroll_to_show(doc, placed, name, m)   where that box has to be
content_reach / content_seen           how long the list is, how much shows
scroll_by_stick(now, push, reach, seen)   a stick that scrolls
```

A screen that names no zones has one called `""`, and then none of this
changes anything - which is why it is the default rather than a mode.

## Reading the other way

Arabic and Hebrew do not put a left-to-right screen in a mirror: the whole
screen turns over. `p("dir", "rtl")` on the **root** says so, and every box in
the flow is mirrored inside its parent - so `align: start` means the right
without knowing that it does, the scrollbar moves to the left, and a line of
text narrower than its box sits against the side the reading ends at.

What is not mirrored: anything placed at a point it named itself. `at_x` is a
screen coordinate, and a nameplate over a head does not move because the menus
turned around.

What this is not is **bidi**. A screen has one direction here; an Arabic
sentence with an English name in the middle of it needs the text engine to
reorder the run, and that is a different piece of work - the same GSUB
machinery Arabic shaping needs.

What a program *says* is orion's `words` orb, not veil's business: the source
says a key, a table says what it sounds like here, and a key nobody translated
answers with itself so a missing saying is visible on the screen rather than
being an empty button.

## The screen, said out loud

A screen reader cannot look at pixels: it has to be told what is there. veil
already knows every part of the answer - what a thing is, what it is called,
what state it is in, and the order a person reads them - so this is that
knowledge gathered rather than invented:

```orion
spoken_screen(doc, placed)   -> [Spoken{name, role_name, says, state}]
```

The page keeps the same screen a second time beside the canvas as plain
elements, out of sight, with ARIA roles and `aria-activedescendant` on
whatever has the ring. A reader reads those. The list and the ring walk the
**same order**, because a reader and a keyboard are the same person navigating
the same screen.

It is rebuilt only when it changed, and at four times a second rather than
sixty: a reader handed a new tree sixty times a second starts its sentence
over sixty times a second, which is worse than saying nothing.

`says:` on a node is what it is called when it has nothing to read - an icon
button shows a glyph and means "close".

## Who gets the input

A game has to ask the UI before it acts, because the UI is on top:

```orion
if not over_ui(doc, dress, placed, mx, my):
    shoot()
if not taking_keys(doc):
    move(w, a, s, d)
if not holding_pad(doc):
    swing_camera(rx, ry)
```

All three are derived from the document already on screen, so none of them can
drift out of step with what is drawn.

The devices themselves are orion's `input` orb, which answers the same eleven
questions on both targets - the Windows runtime out of XInput and raw HID, the
page out of the browser's Gamepad API:

```orion
pads_here()              how many controllers
pad_sort(i)              "xbox" | "dualsense" | "dualshock" | "switch" | "pad"
pad_axis(i, "lx")        -1.0 to 1.0, dead zone already gone
pad_down(i, "south")     names, not letters: south is A and it is cross
pad_pressed(i, "south")  true on the frame it goes down
pad_step_x(i)            one step, then a wait, then a repeat - like a held key
touching()               was the last pointer a finger
last_used()              "mouse" | "keys" | "touch" | "pad"
composing()              text on its way in, from an IME
```

A pad is a **virtual** pad: south, east, west and north, never A/B/X/Y and
never cross/circle/square/triangle. Adding a make is a table in the runtime,
not a branch in your app.

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

Nothing outside the clip is drawn, and neither is anything inside it - so the
cost of a screen is the cost of what you can see on it:

```
24 000 rows in a box showing 33          8 commands
1 000 nameplates, 60 in front of you    61 commands, 1 ms told
20 000 children under ONE node          13 ms to place, 4 ms told
```

## Running it

```
bash tools/gates.sh
```

247 checks, then the wasm target: it builds the gallery, validates the module,
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

- **There is no blend mode.** A picture is drawn over what is under it and
  that is all. An additive glow belongs to a game's renderer rather than to
  its UI, and adding a mode here would split the one draw call the whole
  screen is.
- **Text is placed letter by letter, no kerning.** That is deliberate: veil
  measures a line by adding advances, so it draws it the same way and the two
  can never disagree. `typeface` can read GPOS kerning, but the painters
  cannot - a browser canvas has its own advances - so kerning here would make
  the measurement and the drawing disagree, which is worse than a wide "AV".
- **A native screen reader is not wired up.** The page speaks ARIA. A Windows
  host needs a UI Automation provider - six COM interfaces written out by hand
  in C, and a UIA client written to check them - and that is a project rather
  than an afternoon. The cheap trick was tried and is written down here so it
  is not tried twice: a child window per thing, with its name as the window
  text, which Windows makes accessible for free. It works right up until
  SetWindowTextW on thirty-four of them a second turns the app into a repaint
  storm at a hundred percent of a core. `spoken_screen` is the half of the
  real thing that would not have to be written twice.
- **No shaping.** Arabic needs contextual forms - a letter looks different at
  the start, the middle and the end of a word - and without them Arabic text is
  not ugly, it is unreadable. CJK needs no shaping but does need the glyphs,
  and the 19 kB Inter subset the gallery ships has neither. This is the same
  GSUB/GPOS machinery kerning would need, and it is the one piece of
  localization that is a project rather than a day.
- **Painting is not incremental.** Measuring and placing skip what did not
  change; painting and packing still walk the tree, though they now stop at
  anything outside the clip. Worth knowing and not worth fixing: a whole told
  frame is 0.4 ms in a hidden tab and 0.2 at best, and painting is a fraction
  of that.

## License

Apache 2.0. Copyright 2026 Lone Lodge. See [LICENSE](LICENSE) and
[NOTICE](NOTICE).
