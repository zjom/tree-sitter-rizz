/**
 * tree-sitter grammar for rizz
 *
 * Mirrors the reference parser in ../src/parser/mod.rs and the surface syntax
 * documented in ../SPEC.md. A program is one or more top-level forms; forms
 * are atoms (int, float, string, ident), lists, arrays, maps, or reader-macro
 * forms ('X, `X, ,X, ,@X).
 *
 * Quote contexts: inside (quote …) and (quasiquote …) the form tree uses a
 * parallel set of rules — quoted_list / quoted_ident / etc. — so highlight
 * queries can style data differently from code at arbitrary depth. Inside a
 * quasiquote, (unquote …) and (unquote_splice …) drop their bodies back to
 * the unquoted $._form so code inside the comma resumes normal highlighting.
 *
 * Lexical notes that drive a few odd-looking rules:
 *
 *   - Identifier terminators are exactly: whitespace, ( ) [ ] { } ; :
 *     (see IDENT_SEPARATORS in src/parser/mod.rs). So `.` is NOT a terminator
 *     and `foo.bar` is one ident; a bare `.` separated by whitespace is the
 *     dotted-pair marker. Disambiguation falls out of longest-match + prec.
 *
 *   - `-` followed by a digit dispatches to number parsing; otherwise `-`
 *     begins an ident. The ident regex below carves out that exception.
 *
 *   - Reader-macro prefixes ' ` , cannot start an ident (the reference parser
 *     dispatches on them in parse_expr before reaching parse_atomic). They
 *     may appear *inside* an ident though.
 *
 *   - `:` is an ident terminator and only appears as the key/value separator
 *     inside map entries.
 *
 *   - `;;` starts a line comment; a single `;` not followed by another is a
 *     parse error in the reference impl (StraySemicolon). We surface that as
 *     a tree-sitter ERROR by simply not accepting a single `;` anywhere.
 */

const DELIM = '\\s()\\[\\]{}:;';
const IDENT_INNER = `[^${DELIM}]*`;
const IDENT_FIRST_RESTRICTED = `[^${DELIM}"'\`,0-9\\-]`;
const IDENT_AFTER_MINUS = `[^${DELIM}0-9]`;

module.exports = grammar({
  name: 'rizz',

  extras: $ => [
    /[ \t\r\n]/,
    $.comment,
  ],

  word: $ => $.ident,

  conflicts: $ => [],

  rules: {
    source: $ => repeat1($._form),

    _form: $ => choice(
      $.string,
      $.float,
      $.int,
      $.list,
      $.array,
      $.map,
      $.quote,
      $.quasiquote,
      $.unquote_splice,
      $.unquote,
      $.ident,
    ),

    // Inside (quote …): everything is data. The ident token is reused but
    // aliased so it appears as `quoted_ident` in the tree. unquote /
    // unquote_splice are still accepted (matching the reference parser, which
    // builds the syntax tree without semantic interpretation) and their
    // bodies stay in code mode via $._form.
    _quoted_form: $ => choice(
      $.string,
      $.float,
      $.int,
      $.quoted_list,
      $.quoted_array,
      $.quoted_map,
      $.quote,
      $.quasiquote,
      $.unquote_splice,
      $.unquote,
      alias($.ident, $.quoted_ident),
    ),

    // Inside (quasiquote …): same as quoted, but with quasi_* container types
    // so a query can tell them apart from a plain quote when that matters.
    _quasi_form: $ => choice(
      $.string,
      $.float,
      $.int,
      $.quasi_list,
      $.quasi_array,
      $.quasi_map,
      $.quote,
      $.quasiquote,
      $.unquote_splice,
      $.unquote,
      alias($.ident, $.quasi_ident),
    ),

    comment: _ => token(seq(';;', /[^\n]*/)),

    // Numbers. Float must outrank int so `1.5` is one float token, not int+ident.
    // `1.` is a valid float per spec ("1." parses as 1.0).
    float: _ => token(prec(2, /-?[0-9]+\.[0-9]*/)),
    int:   _ => token(prec(1, /-?[0-9]+/)),

    // Identifiers. Three alternatives:
    //   1. starts with a non-restricted, non-digit, non-`-` byte
    //   2. starts with `-` followed by a non-digit (so `-foo`, `-+`, `--`)
    //   3. a lone `-`
    // Internal bytes accept anything except the ident terminators (including
    // `.`, so `foo.bar` is one token).
    ident: _ => token(new RegExp(
      `(?:${IDENT_FIRST_RESTRICTED}${IDENT_INNER})` +
      `|(?:-${IDENT_AFTER_MINUS}${IDENT_INNER})` +
      `|-`
    )),

    // Strings: `"..."` with escapes \\, \", \n, \r, \t. Any other `\x` is an
    // error in the reference impl; we model that as ERROR by only accepting
    // the listed escapes.
    string: $ => seq(
      '"',
      repeat(choice(
        $._string_content,
        $.escape_sequence,
      )),
      token.immediate('"'),
    ),
    _string_content: _ => token.immediate(/[^"\\]+/),
    escape_sequence: _ => token.immediate(/\\["\\nrt]/),

    // Lists. A standalone `.` between elements (whitespace-surrounded, or
    // immediately before `)`) introduces a dotted (improper) tail. The dot
    // token has higher prec than ident so a lone `.` token wins the tie; any
    // ident that just happens to contain `.` is still longer and wins by
    // length.
    list: $ => choice(
      seq('(', repeat($._form), ')'),
      seq('(', repeat1($._form), $.dot, $._form, ')'),
    ),

    dot: _ => token(prec(3, '.')),

    array: $ => seq('[', repeat($._form), ']'),

    map: $ => seq('{', repeat($.map_entry), '}'),
    map_entry: $ => seq(
      field('key', $._form),
      ':',
      field('value', $._form),
    ),

    // Quoted-context container shapes — mirror list/array/map but recurse
    // into $._quoted_form so the data-styling propagates to any depth.
    quoted_list: $ => choice(
      seq('(', repeat($._quoted_form), ')'),
      seq('(', repeat1($._quoted_form), $.dot, $._quoted_form, ')'),
    ),
    quoted_array: $ => seq('[', repeat($._quoted_form), ']'),
    quoted_map: $ => seq('{', repeat($.quoted_map_entry), '}'),
    quoted_map_entry: $ => seq(
      field('key', $._quoted_form),
      ':',
      field('value', $._quoted_form),
    ),

    // Quasiquote-context container shapes — recurse into $._quasi_form.
    quasi_list: $ => choice(
      seq('(', repeat($._quasi_form), ')'),
      seq('(', repeat1($._quasi_form), $.dot, $._quasi_form, ')'),
    ),
    quasi_array: $ => seq('[', repeat($._quasi_form), ']'),
    quasi_map: $ => seq('{', repeat($.quasi_map_entry), '}'),
    quasi_map_entry: $ => seq(
      field('key', $._quasi_form),
      ':',
      field('value', $._quasi_form),
    ),

    // Reader-macro forms. `,@` must outrank `,` so `,@x` lexes as splice, not
    // unquote-of-`@x`. quote/quasiquote bodies live in their respective
    // form-rule trees; unquote/unquote_splice bodies are always $._form so a
    // comma inside a backquote re-enters code mode.
    quote:          $ => seq("'",  field('datum', $._quoted_form)),
    quasiquote:     $ => seq('`',  field('datum', $._quasi_form)),
    unquote_splice: $ => seq(',@', field('datum', $._form)),
    unquote:        $ => seq(',',  field('datum', $._form)),
  },
});
