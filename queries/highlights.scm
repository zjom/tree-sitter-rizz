;; Syntax highlighting queries for rizz.
;;
;; Most highlighting is structural: keywords are recognised in head position of
;; a list, prelude builtins get a function-style highlight, and the reader
;; macros pick up @punctuation.special.

(comment) @comment

(int)    @number
(float)  @number.float
(string) @string

(escape_sequence) @string.escape

;; Reader-macro prefixes.
"'"  @punctuation.special
"`"  @punctuation.special
","  @punctuation.special
",@" @punctuation.special

;; Brackets.
"(" @punctuation.bracket
")" @punctuation.bracket
"[" @punctuation.bracket
"]" @punctuation.bracket
"{" @punctuation.bracket
"}" @punctuation.bracket

;; Map entry separator and dotted-pair marker.
":"   @punctuation.delimiter
(dot) @punctuation.delimiter

;; Bare identifiers fall back to @variable. Listed first so the more specific
;; head-position captures below override it — tree-sitter highlighters resolve
;; overlapping captures by taking the last matching pattern.
((ident) @variable
 (#not-match? @variable
   "^(let|let!|set!|deref|ref|fn|if|do|quote|quasi|unquote|unquote-splice|eval|defmacro|open|cond|for|loop|while|else)$"))

;; Special forms (§5, §10 of the spec) — recognised only in head position.
(list
  .
  (ident) @keyword
  (#match? @keyword
    "^(let|let!|set!|deref|ref|fn|if|do|quote|quasi|unquote|unquote-splice|eval|defmacro|open)$"))

;; Prelude macros that behave like control flow (§11.10).
(list
  .
  (ident) @keyword.control
  (#match? @keyword.control "^(cond|for|loop|while|else)$"))

;; Anything else in head position of a list is a function call.
(list . (ident) @function
  (#not-match? @function
    "^(let|let!|set!|deref|ref|fn|if|do|quote|quasi|unquote|unquote-splice|eval|defmacro|open|cond|for|loop|while|else)$"))

;; Quoted forms are data, not code. The grammar uses parallel quoted_*/quasi_*
;; node types inside (quote …) and (quasiquote …), so a single capture per
;; symbol kind covers data at any depth. Idents inside (unquote …) /
;; (unquote_splice …) re-enter code mode automatically because those bodies
;; are parsed under the unquoted $._form.
(quoted_ident) @string.special.symbol
(quasi_ident)  @string.special.symbol
