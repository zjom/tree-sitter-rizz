# tree-sitter-rizz

A [tree-sitter](https://tree-sitter.github.io/tree-sitter/) grammar for the
[rizz language](https://github.com/zjom/rizz).

- atoms: `int`, `float`, `string`, `ident`
- compound forms: `list` (including dotted `(a . b)`), `array`, `map`
- reader macros: `'X`, `` `X ``, `,X`, `,@X`
- `;;` line comments; `:` map-entry separator; `.` dotted-pair marker

## Build & test

```sh
cd tree-sitter-rizz
npm install                     # pulls tree-sitter-cli
npx tree-sitter generate        # produces src/parser.c
npx tree-sitter test            # runs the corpus in test/corpus/
npx tree-sitter parse examples/hello.rz
```

## Editor integration

`package.json` declares `*.rz` as the file type and points at
`queries/highlights.scm`. For Neovim:

```lua
vim.filetype.add({ extension = { rz = "rizz" } })

require("nvim-treesitter.parsers").rizz = {
    install_info = {
        path = "~/code/tree-sitter-rizz/",
        files = { "src/parser.c" },
        queries = "queries",
    },
}
```

then `:TSInstall rizz`.

## Notes on disambiguation

A few things in the rizz lexer are context-sensitive and worth a comment:

- `foo.bar` is one ident; `1.5` is one float; a bare `.` between list elements
  is the dotted-pair marker. The grammar disambiguates via longest-match plus
  a small `prec` bump on the `dot` token (see `grammar.js`).
- `-5` is a number; `-foo` is an ident; bare `-` is an ident. The ident regex
  has explicit alternates for the two `-`-starting cases.
- `'`, `` ` ``, `,` cannot start an ident (they're reader-macro prefixes in
  the reference parser), but they can appear inside an ident.
- A single `;` is a syntax error in the reference impl; tree-sitter surfaces
  it as ERROR by not accepting it.
