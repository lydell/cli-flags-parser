import parse from "../index";

test("empty", () => {
  type State = {
    args: Array<string>;
    rest: Array<string>;
  };

  const result = parse<State>([], {
    initialState: {
      args: [],
      rest: [],
    },
    flagRulesFromState: () => [],
    onArg: (arg, state) => ({
      tag: "Ok",
      state: { ...state, args: state.args.concat(arg) },
    }),
    onRest: (rest, state) => ({
      tag: "Ok",
      state: { ...state, rest: state.rest.concat(rest) },
    }),
  });

  expect(result).toMatchInlineSnapshot(`
    Object {
      "state": Object {
        "args": Array [],
        "rest": Array [],
      },
      "tag": "Ok",
    }
  `);
});

test("value flag not last in group", () => {
  type State = {
    a: number;
    b: number;
    c: number;
    abc: number;
  };

  const result = parse<State>(["--abc=10", "-abc=20"], {
    initialState: {
      a: 0,
      b: 0,
      c: 0,
      abc: 0,
    },
    flagRulesFromState: () => [
      [
        ["-a"],
        (state: State) => ({
          tag: "Ok" as const,
          state: { ...state, a: state.a + 1 },
        }),
      ],
      [
        ["-b"],
        "a number",
        (v: string, state: State) => ({
          tag: "Ok" as const,
          state: { ...state, b: state.b + Number(v) },
        }),
      ],
      [
        ["-c"],
        "a number",
        (v: string, state: State) => ({
          tag: "Ok" as const,
          state: { ...state, c: state.c + Number(v) },
        }),
      ],
      [
        ["--abc"],
        "a number",
        (v: string, state: State) => ({
          tag: "Ok" as const,
          state: { ...state, abc: state.abc + Number(v) },
        }),
      ],
    ],
    onArg: fail,
    onRest: fail,
  });

  expect(result).toMatchInlineSnapshot(`
    Object {
      "error": Object {
        "name": "-b",
        "tag": "ValueFlagNotLastInGroup",
        "valueDescription": "a number",
      },
      "tag": "FlagError",
    }
  `);
});

test("value flag IS last in group", () => {
  type State = {
    a: number;
    b: number;
    c: number;
    abc: number;
  };

  const result = parse<State>(["--abc=10", "-abc=20"], {
    initialState: {
      a: 0,
      b: 0,
      c: 0,
      abc: 0,
    },
    flagRulesFromState: () => [
      [
        ["-a"],
        (state: State) => ({
          tag: "Ok" as const,
          state: { ...state, a: state.a + 1 },
        }),
      ],
      [
        ["-b"],
        (state: State) => ({
          tag: "Ok" as const,
          state: { ...state, b: state.b + 1 },
        }),
      ],
      [
        ["-c"],
        "a number",
        (v: string, state: State) => ({
          tag: "Ok" as const,
          state: { ...state, c: state.c + Number(v) },
        }),
      ],
      [
        ["--abc"],
        "a number",
        (v: string, state: State) => ({
          tag: "Ok" as const,
          state: { ...state, abc: state.abc + Number(v) },
        }),
      ],
    ],
    onArg: fail,
    onRest: fail,
  });

  expect(result).toMatchInlineSnapshot(`
    Object {
      "state": Object {
        "a": 1,
        "abc": 10,
        "b": 1,
        "c": 20,
      },
      "tag": "Ok",
    }
  `);
});

test("handle remaining as rest", () => {
  type State = {
    args: Array<string>;
    noInstall: number;
  };

  const result = parse<State>(["--no-install", "jest", "--coverage"], {
    initialState: {
      args: [],
      noInstall: 0,
    },
    flagRulesFromState: () => [
      [
        ["--no-install"],
        (state: State) => ({
          tag: "Ok" as const,
          state: { ...state, noInstall: state.noInstall + 1 },
        }),
      ],
    ],
    onArg: (arg: string, state: State) => ({
      tag: "Ok",
      state: { ...state, args: state.args.concat(arg) },
      handleRemainingAsRest: true,
    }),
    onRest: (rest: Array<string>, state: State) => ({
      tag: "Ok",
      state: { ...state, args: state.args.concat(rest) },
    }),
  });

  expect(result).toMatchInlineSnapshot(`
    Object {
      "state": Object {
        "args": Array [
          "jest",
          "--coverage",
        ],
        "noInstall": 1,
      },
      "tag": "Ok",
    }
  `);
});

test("arg error", () => {
  const result = parse(["arg"], {
    initialState: {},
    flagRulesFromState: () => [],
    onArg: () => ({
      tag: "Error",
      error: "Arg error",
    }),
    onRest: fail,
  });

  expect(result).toMatchInlineSnapshot(`
    Object {
      "error": "Arg error",
      "tag": "ArgError",
    }
  `);
});

test("rest error", () => {
  const result = parse(["--"], {
    initialState: {},
    flagRulesFromState: () => [],
    onArg: fail,
    onRest: () => ({
      tag: "Error",
      error: "Rest error",
    }),
  });

  expect(result).toMatchInlineSnapshot(`
    Object {
      "error": "Rest error",
      "tag": "ArgError",
    }
  `);
});

test("a single dash should be an arg", () => {
  const result = parse(["-"], {
    initialState: "",
    flagRulesFromState: () => [],
    onArg: (arg) => ({ tag: "Ok", state: arg }),
    onRest: fail,
  });

  expect(result).toMatchInlineSnapshot(`
    Object {
      "state": "-",
      "tag": "Ok",
    }
  `);
});
