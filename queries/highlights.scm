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

;; Special forms (§5, §10 of the spec) — recognised only in head position.
(list
  .
  (ident) @keyword
  (#match? @keyword
    "^(let|let!|fn|if|do|quote|quasi|unquote|unquote-splice|eval|defmacro|open)$"))

;; Prelude macros that behave like control flow (§11.10).
(list
  .
  (ident) @keyword.control
  (#match? @keyword.control "^(cond|for|loop|while|else)$"))

;; Anything else in head position of a list is a function call.
(list . (ident) @function)

;; Common boolean-ish builtins.
((ident) @constant.builtin
 (#match? @constant.builtin "^(true|false|nil)$"))

;; Bare identifiers fall back to @variable.
(ident) @variable
