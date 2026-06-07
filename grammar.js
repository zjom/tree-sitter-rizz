/**
 * tree-sitter grammar for rizz
 *
 * Mirrors the reference parser in ../src/parser/mod.rs and the surface syntax
 * documented in ../SPEC.md. A program is one or more top-level forms; forms
 * are atoms (int, float, string, ident), lists, arrays, maps, or reader-macro
 * forms ('X, `X, ,X, ,@X).
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

    // Reader-macro forms. `,@` must outrank `,` so `,@x` lexes as splice, not
    // unquote-of-`@x`.
    quote:          $ => seq("'",  field('datum', $._form)),
    quasiquote:     $ => seq('`',  field('datum', $._form)),
    unquote_splice: $ => seq(',@', field('datum', $._form)),
    unquote:        $ => seq(',',  field('datum', $._form)),
  },
});
