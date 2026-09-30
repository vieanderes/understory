# Writing code on a phone

Many learners study mostly on a phone, and early testers found writing code there very poor.
This document records what the best mobile coding tools and the
research do, what iOS Safari allows a web page to do, and what Understory does as a result.
Read it before changing `src/features/editor/`.

## 1. The problem, measured on a 390 px iPhone

Before this work a phone got the desktop CodeMirror editor, 16 px text, and one scrolling
row of symbol keys that rode on the keyboard. What still hurt:

- **Every word is typed letter by letter.** Autocorrect and prediction are off, as they
  must be for code, so `function` is eight taps and `querySelector` thirteen.
- **Structure costs the most.** `if (x) {`, a line break, the indent, `}`: brackets,
  braces and the indent are on the second and third keyboard layers.
- **The caret is hard to place.** iOS drags the caret with a magnifier, and the hidden
  space-bar trackpad works, but few people know it, and neither is precise between two
  brackets.
- **The keyboard hides half the page.** With the keyboard, Safari's form bar and the
  symbol row up, about 380 of 844 px are left. The Run button sits under the editor, so
  running meant closing the keyboard, scrolling and tapping.
- **No room.** The editor shares its viewport with the prompt, the results and the page
  chrome.

## 2. What the best tools do

| Tool                                  | What it does on a phone                                                                                                                                                                                                                                                                             | What we take                                                                                                               |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Swift Playgrounds (iPad, iPhone, Mac) | A **shortcuts bar** above the keyboard shows code suggestions based on the code in the book, plus controls to delete and add a line. Tapping a suggestion inserts it at the insertion point; completions appear as you type. Placeholders inside an inserted call are tokens you tap to fill. [1]   | A suggestion row above the keyboard, drawn from the code on screen, with placeholders you move through.                    |
| Replit mobile                         | A coding toolbar with undo, redo, indent and toggle comment, a clipboard manager, and a **local-first completion engine**: it parses on the device with Lezer (CodeMirror's parser) on every keystroke and has a library of language snippets for Python, HTML, CSS, JavaScript and TypeScript. [2] | Suggestions computed on the device from the document, no server, fast enough for every keystroke. Snippets per language.   |
| Textastic                             | An **additional row of keys** above the stock keyboard: up to 50 characters, the row scrolls sideways, and swipes move the cursor. Its author notes a third-party iOS keyboard must replace the whole keyboard, so a row is the only way to add keys. [3]                                           | Our symbol row already follows this. The row is the right unit; a custom keyboard is not possible on the web anyway.       |
| Pythonista                            | The extra key row **doubles as a gesture area**: slide a finger along it to move the cursor precisely. [4]                                                                                                                                                                                          | A drag on the cursor keys moves the caret by characters and lines.                                                         |
| Koder, Codeanywhere, Runestone editor | The same pattern: a key row with symbols, Tab and arrow keys. Koder and Codeanywhere put arrow keys at a fixed end of the row. Runestone (the iOS text engine) adds line selection and indent on the row.                                                                                           | Arrow keys at a fixed end, never scrolled away. Select word and select line.                                               |
| iOS itself                            | Touch and hold the space bar turns the keyboard into a trackpad (iOS 12 and later); the caret can be dragged directly (iOS 13 and later). [5]                                                                                                                                                       | Keep it working (we never cancel touches on the editor) and add our own visible keys for people who do not know the trick. |
| Grasshopper (Google, closed 2025)     | Beginners **tap code pieces** to insert them and type only strings and names. Reviewers single this out as what makes JavaScript writable on a phone. [6]                                                                                                                                           | Token insertion is powerful, but it removes recall. See section 4 for where we allow it.                                   |
| Mimo, Sololearn, Enki                 | Most phone exercises are **tap-to-fill**: choose tokens from a bank to complete a line, or arrange lines. Free typing is reserved for a separate playground with a symbol row. [7]                                                                                                                  | We already have `fill-blank` (a token bank) and `parsons`. Phone sessions already prefer step types that need no typing.   |
| GitHub mobile                         | Viewing, review and comments only; it edits a file through a plain text field. github.dev does not run on phones.                                                                                                                                                                                   | A reminder that "a desktop editor on a phone" is what most tools still ship. Nothing to copy.                              |

## 3. What the research says

- **TouchDevelop** (Microsoft Research) asked whether real apps can be written on a phone
  with no keyboard. Its answer was a structured editor: the program is a tree, and the
  learner picks the next token from a context-sensitive list rather than typing characters.
  It made phone programming possible, at the cost of never writing text code. [8]
- **Syntax-directed key rows beat plain keyboards.** A keyboard extension whose keys are
  language constructs (a loop, a condition, a declaration) instead of characters led to
  fewer errors and fewer keystrokes per character than the stock keyboard, and participants
  rated it less mentally demanding. [9] A gestural code keyboard was also faster than
  QWERTY and than an earlier programming keyboard in its own study. [10]
- **The design space** of programming tools on touch screens (a 2017 survey) sorts tools by
  how much they replace text: from plain editors with key rows, through text editors with
  structure-aware insertion, to fully structured and block editors. The middle ground keeps
  real code while removing most of the character-level typing. [11]
- **Parsons problems on phones work.** They fit short sessions, take about half the time of
  writing the equivalent code, and a mobile Python tutor with Parsons problems and
  self-explanation prompts improved learning, most of all for learners with little prior
  knowledge. [12] [13] This is why phone sessions already lean on parsons, fill-blank,
  predict and trace steps (docs/CONTENT-GUIDE.md).
- **Recall matters.** Understory's editor is "Unplugged" on purpose (docs/LEARNING-SCIENCE.md,
  principle 9): delegating generation to a tool cuts comprehension. Any typing aid must
  save taps without choosing the code for the learner.

## 4. The line we draw: typing help, not answers

Completion comes in two kinds, and only one is allowed in a code challenge:

1. **Typing help** finishes what the learner has started and cannot tell them what to
   write. A keyword they began (`fu` to `function`), a name that is already in their file
   (`tot` to `total`, which they or the starter wrote), the brackets and body that a
   keyword always needs (`if` gives `if () {}` with the caret in the brackets).
2. **Recall help** proposes something the learner has not shown they know: an API member
   (`.toFixed`), a global they have not used, the next line.

The code challenge ("Write · Unplugged") gets typing help only, and only after the learner
has typed at least one letter. The suggestions come from two sources: the language's
keywords, and the words already in the document. Nothing from outside the file, and
nothing before the first letter. It works like a phone keyboard's word completion for a
vocabulary the learner has already met. The label says "no AI, no code hints".

The playground ("Build · Live") and the sql step ("Query · Live") are for trying things and
seeing the result. They also get a small vocabulary of the language: HTML tags, CSS
properties and common values, SQL keywords, and the tables and columns of the database the
step runs.

Desktop keeps no suggestions at all. A hardware keyboard makes typing cheap, and the
strip exists only for coarse pointers.

## 5. What iOS Safari allows

| Fact                                                                                                                                                                                                                                | Consequence                                                                                                                                                                            |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Safari zooms the page into any focused text field whose computed font size is under 16 px, contenteditable editors included, and does not zoom back. [14]                                                                           | The editor is 16 px on coarse pointers (it already was). Nothing typed into is ever smaller.                                                                                           |
| When the keyboard opens, Safari keeps the **layout viewport** at full height and shrinks only the **visual viewport**; `position: fixed; bottom: 0` ends up under the keyboard. Chrome on Android shrinks the layout viewport. [15] | Anything that must sit on the keyboard is placed from `window.visualViewport` (`useVisualViewport`), not from `bottom: 0`.                                                             |
| The VirtualKeyboard API and the `interactive-widget` viewport key are Chromium only. WebKit has an open bug for the former. [16]                                                                                                    | No shortcut: the visual viewport is the only signal on an iPhone.                                                                                                                      |
| Safari shows its own form bar (previous, next, Done) above the keyboard for editable content. A page cannot remove it.                                                                                                              | About 44 px more is gone. Our rows must be compact: two rows of 48 px keys at most.                                                                                                    |
| `enterkeyhint` is supported since Safari 13.1. `autocapitalize`, `autocorrect="off"` and `spellcheck="false"` are honoured on contenteditable; iOS Smart Punctuation is not switched off by any attribute.                          | The editor sets `enterkeyhint="enter"` so the return key reads as a line break, not "Go". Curly quotes are straightened as they arrive (smart-punctuation.ts, since before this work). |
| Apple's Human Interface Guidelines ask for touch targets of at least 44 by 44 points.                                                                                                                                               | Keys are 40 by 48 px or larger with 4 px between them; cursor keys are 48 by 48. DESIGN.md's floor is 40.                                                                              |
| Text-size scaling: `-webkit-text-size-adjust: 100%` stops Safari inflating text in landscape; the user's Dynamic Type does not reach web text unless the page uses `font: -apple-system-body`.                                      | We keep `100%` and rem sizes, so browser zoom still scales everything.                                                                                                                 |
| Safe areas: with `viewport-fit=cover`, the home indicator and the notch cover content unless padded with `env(safe-area-inset-*)`.                                                                                                  | The full-screen editor pads its bottom and sides with the safe-area insets.                                                                                                            |
| Selection handles and the edit menu are native. CodeMirror keeps a native DOM selection on touch devices, so iOS handles, the magnifier and the space-bar trackpad all work.                                                        | We never cancel `touchstart` on the editor. Our keys cancel their own `pointerdown`, so the editor keeps focus and the keyboard stays up.                                              |

## 6. Decisions

1. **One keyboard bar, two rows while typing.** The existing symbol row stays where it is.
   While the editor has focus and the keyboard is up, a second row sits above it:
   suggestions on the left, cursor keys fixed on the right. Two rows of 48 px keys fit above
   Safari's form bar and still leave about 11 lines of code visible on a 390 by 844 iPhone.
   A single mixed row was rejected: suggestions coming and going would move the brackets
   under the thumb, and muscle memory is what makes a key row fast.
2. **Suggestions follow section 4.** Up to eight, ranked by: words in the document before
   keywords before vocabulary, then by how close to the caret they were last written. A
   suggestion that equals what is already typed is dropped. The list is computed on the
   device from the CodeMirror state on every change; it is a few hundred words at most.
3. **Keywords that open a block insert the block.** Tapping `if` in JavaScript inserts
   `if () {}` over three lines with the caret between the brackets; the next field is the
   body. The same for `for`, `while`, `function`, `else`, `switch`, `try`, `class`, and in
   Python for `if`, `elif`, `else`, `for`, `while`, `def`, `class`, `try`. A tapped HTML tag
   inserts its end tag. A tapped CSS property inserts `: ;`. This is typing help: the
   learner chose the keyword; the brackets are what the grammar demands.
4. **Fields you move through.** An inserted block has fields, drawn with a faint band. Tab
   (on a hardware keyboard) or the "Next" key in the row moves to the next field; Escape
   ends it. When no block is active the Next key is not shown.
5. **Cursor keys that are also a trackpad.** Left and right are fixed at the end of the
   suggestion row. A tap moves one character, holding repeats, and dragging across them
   moves the caret one character per 12 px sideways and one line per 24 px up or down,
   the Pythonista gesture. When nothing has been typed yet, the row shows "Select word"
   and "Select line" in place of suggestions, since iOS selection by long press is slow on
   code.
6. **Run while typing.** The suggestion row carries a Run key when the step has one, so a
   run never needs the keyboard to close.
7. **A full-screen editor on demand.** An Expand key opens the same editor instance (no
   remount, no lost undo history) fixed to the visual viewport: a slim header with the
   editor's name, Run, and Close; the code filling the space; the two rows at the bottom.
   It follows the keyboard as it opens and closes, pads the safe areas, and locks the page
   behind it. It is a modal dialog for assistive technology; Escape closes it and focus
   returns to the Expand key. It is optional: a short edit in place stays in place.
8. **The caret is always visible.** CodeMirror already scrolls the caret clear of the
   visual viewport; the scroll margin now matches whichever rows are showing (56 or 104 px).
9. **Defaults.** 16 px text and 24 px lines on touch, wrapping below 768 px (with a hanging
   indent since round 2, section 8.1), auto-indent,
   bracket and quote pairing, HTML end tags, no autocapitalise, no autocorrect, no spell
   check, straight quotes, `enterkeyhint="enter"`, Undo pinned and Redo one flick away.
10. **Desktop is unchanged.** No strip and no rows. Blocks are inserted only from the strip,
    so on desktop Tab indents exactly as before.

## 7. Considered and not done (yet)

- **A token keyboard for code challenges** (Grasshopper style). It turns writing into
  choosing, which is what fill-blank and parsons are for. The code challenge is where the
  learner proves they can produce the code.
- **Voice input** of code. Dictation cannot spell brackets or indentation reliably, and
  Smart Punctuation bends what it produces.
- **A custom on-screen keyboard.** A web page cannot replace the iOS keyboard, and drawing
  one inside the page would lose the trackpad, dictation, accessibility and every language
  layout.

## 8. Round 2: what the 390 px screenshots still showed

Written the same day, after looking at round 1 on a 390 px screen. Four things still read
badly, and one cost the lesson route bytes.

### 8.1 Long lines

A comment in a function body wrapped into three rows that started at the left edge, so
they read as three statements. Three options were weighed:

| Option                                      | For                                                                  | Against                                                                                                                               |
| ------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| No wrap, scroll inside the editor           | Code keeps its shape; what desktop editors and GitHub mobile do.     | At 28 to 32 columns most lines end off-screen. Reading a line means scrolling it, and the caret drags the view sideways while typing. |
| Wrap at the edge (round 1)                  | Everything is on screen.                                             | A wrapped row looks like a new line of code.                                                                                          |
| Wrap with a hanging indent (VS Code, Xcode) | Everything is on screen, and a continued row is clearly subordinate. | Rows are a little narrower after the first.                                                                                           |

**Decision: wrap, with a hanging indent**, as VS Code's `wrappingIndent: "indent"` and
Xcode's "indent wrapped lines" do [18] [19]. Each row after the first starts under the
line's own code, two columns further in (`hanging-indent.ts`, `src/core/content/indent.ts`).
The build writes the same indent into highlighted code (`--hang`, scripts/lib/render.ts),
so the placeholder and every code view on a phone wrap the same way, and nothing moves
when the editor takes over. The text stays at 16 px: that is iOS Safari's floor before it
zooms (section 5), so "a slightly smaller font" is not available; the room comes from the
chrome instead. The number column drops from 3 rem to 2 rem and the right padding from
2 rem to 0.5 rem, which takes a 390 px phone from 28 columns of code to 32.

### 8.2 Full screen that is full

Round 1 fixed the editor to the visual viewport, but the lesson's own fixed footer
(How sure, Skip, Check) and whatever the page had below still showed wherever the
editor did not reach, most visibly where iOS lets the page slide under the keyboard.

- A backdrop (`.editor-expanded::before`) covers the whole layout viewport, so nothing of
  the lesson shows through anywhere.
- The header is one 48 px row: **Task**, the last run's status, **Run** and **Done**. Task
  opens the step's prompt under it: two lines of it while closed as a reminder, up to 30%
  of the visual viewport, scrolling, while open. The prompt is passed in as `task`.
- Task and Run cancel their `mousedown`, so they do not take focus and the keyboard stays
  up. Done does take it, and focus goes back to the Full screen key.
- The Run key leaves the suggestion row in full screen, since Run is in the header.

### 8.3 The key row

At 390 px the symbol row showed five keys before it scrolled, because three keys were
pinned at its end (Indent, Undo, Full screen).

- **Full screen moved to the editor's header row**, next to the step's label and Reset.
  Every step passes its header row to the editor as `header`, and the placeholder draws
  the same row, with the key's space kept, so the swap moves nothing. The playground,
  which shows one file per tab, now keeps one editor and swaps the document
  (`documentKey`) instead of remounting it, so its tabs in the header keep focus.
- **Only Undo is pinned.** Redo is its long press. Indent, Outdent and Redo move to the end
  of the scrolling row: auto-indent after Enter and Backspace in leading space do most of
  that work.
- **Seven keys show before a scroll, in an order per language** (`symbolKeysFor`):
  brackets and the semicolon in JavaScript, the colon early in TypeScript, the colon,
  quotes and the underscore of snake_case first in Python (it was 24th), tags in HTML,
  rules in CSS, the star and quotes in SQL. Keys a language never types (the arrow in
  Python, backticks in SQL) are left out.
- **Long press types a partner**, as the iOS keyboard does for accented letters: `(` gives
  `[`, `)` gives `]`, `'` gives `"`, `.` gives `,`, `;` gives `:`, `-` gives `_`. The partner is
  drawn small in the key's corner, so it can be found by looking. It is always a shortcut
  for a key that is also further along the row, never the only way to a character.

### 8.4 The editable region (section 7 of round 1, now built)

A code challenge can name the starter lines the learner writes: `editable: "2-3"`
(docs/CONTENT-GUIDE.md, "Editable region"). The rest is locked.

- **Anchored on text.** The locked head and tail of the starter must still open and close
  the document (`src/core/content/editable.ts`); the region is found again after every
  change instead of mapped, so a Reset or a restored draft cannot confuse it. A draft saved
  before the region existed has no lock.
- **Changes on locked lines are dropped** by a change filter. Select all and delete empties
  only the region, and the caret then waits in it.
- **A tap on a locked line puts the caret at the nearest place to type**: after the indent
  of the first open line from above, at the end of the region from below. Keyboard
  movement is left alone, so a screen reader can still walk every line.
- **Drawn as a gap to fill.** The open lines carry a 2 px accent bar and full-strength line
  numbers; the locked lines sit on the page tone. The accent marks a knowledge gap, which
  is what the region is. A line under the editor says so in words.
- The validator requires the range to exist, to lock at least one line, and the solution
  to match the starter outside it. Five early challenges use it: 00-basics 04, 06 and 08,
  and 03-javascript 09 and 13, each with scaffold (a signature, data, a class) that the
  task is not about.

### 8.5 Bytes

The lesson route was at 310.7 of 313 KB. The code challenge step, with the editor's frame,
the draft store and the test results, was eager in the route while the playground and
the sql step were already their own chunks. It is now a chunk of its own too, and the
player fetches the next step's chunk while the current one is read (`preloadStep`), so a
code step never waits. The route is 306.0 KB; the editor stage grew from 177 to 185 KB of
its 220 KB.

## 9. Sources

1. Apple, "Enter code in a playground book in Swift Playground on iPad",
   https://support.apple.com/guide/playgrounds-ipad/enter-code-in-a-playground-book-itc14b3eb0fa/ipados,
   and WWDC19 session 405, "Swift Playgrounds 3", https://developer.apple.com/videos/play/wwdc2019/405/
2. Replit, "Replit Mobile App", https://blog.replit.com/mobile-app
3. Textastic manual, "Additional row of keys above the standard keyboard",
   https://www.textasticapp.com/v10/manual/viewing_editing_files/additional_keys.html, and
   the feedback thread "Standalone Textastic-style keyboard",
   https://feedback.textasticapp.com/communities/1/topics/949-standalone-textastic-style-keyboard
4. Pythonista documentation, "Using Pythonista", https://omz-software.com/pythonista/docs/ios/pythonista.html
5. Macworld, "How to turn your iPhone keyboard into a trackpad",
   https://www.macworld.com/article/558720/how-to-iphone-keyboard-trackpad.html
6. freeCodeCamp, "How to use Google's Grasshopper coding app to learn coding basics on your phone",
   https://www.freecodecamp.org/news/a-history-of-googles-grasshopper-coding-app-and-how-to-learn-coding-basics-on-your-phone/,
   and Android Central, https://www.androidcentral.com/google-grasshopper
7. Coddy, "Mimo review (2026)", https://coddy.tech/vs/mimo, and Mimo,
   https://mimo.org/mimo-coding-app
8. Tillmann, Moskal, de Halleux and Fähndrich, "TouchDevelop: programming cloud-connected
   mobile devices via touchscreen", Onward! 2011, https://mmoskal.github.io/pdf/touchdevelop-tr.pdf
9. "Evaluation of a visual programming keyboard on touchscreen devices", IEEE VL/HCC 2018,
   https://ieeexplore.ieee.org/document/8506557/
10. "The design and evaluation of a gestural keyboard for entering programming code on mobile
    devices", IEEE VL/HCC 2018, https://ieeexplore.ieee.org/document/8506501/
11. "Design space of programming tools on mobile touchscreen devices", 2017,
    https://arxiv.org/pdf/1708.05805
12. Karavirta, Helminen and Ihantola, "A mobile learning application for Parsons problems
    with automatic feedback", Koli Calling 2012, https://dl.acm.org/doi/10.1145/2401796.2401798
13. Fabic, Mitrovic and Neshatian, "Evaluation of Parsons problems with menu-based
    self-explanation prompts in a mobile Python tutor", IJAIED 2019,
    https://link.springer.com/article/10.1007/s40593-019-00184-0
14. CSS-Tricks, "16px or larger text prevents iOS form zoom",
    https://css-tricks.com/16px-or-larger-text-prevents-ios-form-zoom/
15. Bram Van Damme, "Prevent content from being hidden underneath the virtual keyboard",
    https://www.bram.us/2021/09/13/prevent-items-from-being-hidden-underneath-the-virtual-keyboard-by-means-of-the-virtualkeyboard-api/
16. MDN, "VirtualKeyboard API", https://developer.mozilla.org/en-US/docs/Web/API/VirtualKeyboard_API,
    and WebKit bug 230225, https://bugs.webkit.org/show_bug.cgi?id=230225
17. Apple, Human Interface Guidelines, "Virtual keyboards",
    https://developer.apple.com/design/human-interface-guidelines/virtual-keyboards
18. Visual Studio Code, "User and workspace settings", `editor.wrappingIndent`,
    https://code.visualstudio.com/docs/getstarted/settings
19. Apple, Xcode text editing settings, "Indent wrapped lines by",
    https://developer.apple.com/documentation/xcode/text-editing-settings

## 10. Where it lives and how it is tested

- `src/features/editor/suggestions.ts` decides what the row offers (section 4), `snippet.ts`
  inserts blocks and moves through their gaps, `cursor.ts` moves and selects, and
  `SymbolBar.tsx` draws both rows, `symbols.ts` orders the keys per language.
  `CodeEditor.tsx` owns the header row and the full-screen mode. `hanging-indent.ts` and
  `editable-region.ts` are the round 2 extensions.
- Unit tests in `tests/unit/ui/editor/`. `tests/e2e/mobile-editing.spec.ts` replaces the
  visual viewport before the page loads with one that a test can shrink, as iOS does when
  the keyboard opens, then writes a code challenge's body and a playground with the rows,
  checks the caret's line stays above them, taps locked lines, checks that nothing of the
  lesson shows around the full-screen editor, and runs axe at rest, with the rows up and in
  full screen, for the challenge and the playground, in both themes. Set
  `MOBILE_EDITING_SHOTS` to a folder to keep screenshots.
- Found while testing: the step's entrance animation kept `transform` in effect after it
  ended (`animation-fill-mode: both`), which made the step the containing block for
  `position: fixed`. The symbol row had been docking to the step, not to the keyboard.
  `.step-in` now fills `backwards` only.
