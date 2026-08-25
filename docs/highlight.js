// Orion syntax highlighting for the Field Guide. Mirrors the token categories
// of the VS Code grammar (tools/vscode/syntaxes/orion.tmLanguage.json) so the
// page and the editor agree on what a keyword, a type, a string is. Pure
// client-side, no dependency, works when the file is opened straight from disk.
//
// The palette is warm to match the guide and each colour clears AA (>=4.5:1) on
// the code background; body text and links stay AAA. tools/docs_check.sh
// measures all of it. Comments stay the dim tone the guide already used.
(function () {
  // The v2 keyword set (the target surface the Field Guide shows; the VS Code
  // grammar follows as the migration lands).
  const KEYWORDS = new Set([
    'if', 'then', 'else', 'choose', 'loop', 'break', 'continue', 'in', 'where',
    'return', 'require', 'ensure', 'defer', 'use', 'public', 'external',
    'define', 'type', 'effect', 'handle', 'perform', 'resume', 'let', 'orb',
    'not', 'and', 'or', 'deterministic', 'parallel', 'edit', 'collect', 'is',
    'try', 'given', 'to', 'until', 'of', 'compile_time'
  ]);
  // Built-in type names, plus the value words.
  const TYPES = new Set([
    'number', 'truth', 'text', 'table', 'list', 'maybe', 'result', 'byte'
  ]);
  const CONSTS = new Set(['true', 'false', 'none']);
  // Words the language retired: painted as an error, like the editor does.
  const RETIRED = new Set([
    'data', 'enum', 'for', 'comptime', 'take', 'dyn', 'region', 'query',
    'fn', 'mut', 'pub', 'extern', 'match', 'yield', 'const', 'int', 'float', 'bool'
  ]);

  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const span = (cls, s) => '<span class="' + cls + '">' + esc(s) + '</span>';

  // Tokenise one block of Orion source into highlighted HTML. Single left-to-
  // right pass: comments and strings win first (they may contain keyword-like
  // words), then numbers, then identifiers get classified, everything else
  // (operators, punctuation, whitespace) passes through as plain text.
  function highlight(src) {
    let out = '';
    let i = 0;
    const n = src.length;
    const ident = /[A-Za-z_][A-Za-z0-9_]*/y;
    const number = /0[xX][0-9a-fA-F_]+|0[oO][0-7_]+|0[bB][01_]+|[0-9][0-9_]*\.[0-9][0-9_]*([eE][+-]?[0-9]+)?|[0-9][0-9_]*([eE][+-]?[0-9]+)?/y;
    while (i < n) {
      const ch = src[i];
      // comment to end of line
      if (ch === '#') {
        let j = src.indexOf('\n', i);
        if (j < 0) j = n;
        out += span('hl-c', src.slice(i, j));
        i = j;
        continue;
      }
      // double-quoted string (with \ escapes); interpolation holes ride along
      if (ch === '"') {
        let j = i + 1;
        while (j < n && src[j] !== '"') { j += (src[j] === '\\') ? 2 : 1; }
        j = Math.min(j + 1, n);
        out += span('hl-s', src.slice(i, j));
        i = j;
        continue;
      }
      // char literal 'x' or '\n'
      if (ch === "'" && (src[i + 2] === "'" || (src[i + 1] === '\\' && src[i + 3] === "'"))) {
        const len = src[i + 1] === '\\' ? 4 : 3;
        out += span('hl-s', src.slice(i, i + len));
        i += len;
        continue;
      }
      // number
      number.lastIndex = i;
      const nm = number.exec(src);
      if (nm && nm.index === i) {
        out += span('hl-n', nm[0]);
        i += nm[0].length;
        continue;
      }
      // identifier -> classify
      ident.lastIndex = i;
      const im = ident.exec(src);
      if (im && im.index === i) {
        const w = im[0];
        const lw = w.toLowerCase();
        let cls = null;
        if (RETIRED.has(w)) cls = 'hl-x';
        else if (KEYWORDS.has(w)) cls = 'hl-k';
        else if (CONSTS.has(w)) cls = 'hl-n';
        else if (TYPES.has(lw)) cls = 'hl-t';
        else if (/^[A-Z]/.test(w)) cls = 'hl-t';       // a Capitalised name reads as a type/variant
        else if (src[i + w.length] === '(') cls = 'hl-f'; // a call
        out += cls ? span(cls, w) : esc(w);
        i += w.length;
        continue;
      }
      // anything else: one plain char (operators, punctuation, whitespace)
      out += esc(ch);
      i += 1;
    }
    return out;
  }

  function paint(code) {
    code.innerHTML = highlight(code.textContent);
  }

  function paintAll() {
    document.querySelectorAll('pre > code').forEach(paint);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', paintAll);
  } else {
    paintAll();
  }

  // The inline samples are contenteditable (playground.js). Re-highlight when
  // the reader leaves the box, never mid-keystroke, so the caret never jumps.
  document.addEventListener('blur', (e) => {
    const code = e.target;
    if (code && code.matches && code.matches('pre > code[contenteditable]')) paint(code);
  }, true);
})();
