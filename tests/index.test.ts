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

test("short and long flags, with and without values", () => {
  type State = {
    h: number;
    help: number;
    longH: number;
    d: Array<string>;
    "dashed-NAME": Array<string>;
    "9": number;
    "#": number;
    "?": number;
    "Iñtërnâtiônàlizætiøn 💩": number;
  };

  const result = parse<State>(
    [
      "-h",
      "--help",
      "--h",
      "-d",
      "-h",
      "--dashed-NAME",
      "--help",
      "-d=o=o",
      "--dashed-NAME=[ weird, thing ]",
      "-9#?",
      "--nine",
      "--Iñtërnâtiônàlizætiøn 💩",
    ],
    {
      initialState: {
        h: 0,
        help: 0,
        longH: 0,
        d: [],
        "dashed-NAME": [],
        "9": 0,
        "#": 0,
        "?": 0,
        "Iñtërnâtiônàlizætiøn 💩": 0,
      },
      flagRulesFromState: () => [
        [
          ["-h"],
          (state) => ({ tag: "Ok", state: { ...state, h: state.h + 1 } }),
        ],
        [
          ["--help"],
          (state) => ({ tag: "Ok", state: { ...state, help: state.help + 1 } }),
        ],
        [
          ["--h"],
          (state) => ({
            tag: "Ok",
            state: { ...state, longH: state.longH + 1 },
          }),
        ],
        [
          ["-d"],
          "a value",
          (value, state) => ({
            tag: "Ok",
            state: { ...state, d: state.d.concat(value) },
          }),
        ],
        [
          ["--dashed-NAME"],
          "a value",
          (value, state) => ({
            tag: "Ok",
            state: {
              ...state,
              "dashed-NAME": state["dashed-NAME"].concat(value),
            },
          }),
        ],
        [
          ["-9", "--nine"],
          (state) => ({ tag: "Ok", state: { ...state, 9: state[9] + 1 } }),
        ],
        [
          ["-#"],
          (state) => ({ tag: "Ok", state: { ...state, "#": state["#"] + 1 } }),
        ],
        [
          ["-?"],
          (state) => ({ tag: "Ok", state: { ...state, "?": state["?"] + 1 } }),
        ],
        [
          ["--Iñtërnâtiônàlizætiøn 💩"],
          (state) => ({
            tag: "Ok",
            state: {
              ...state,
              "Iñtërnâtiônàlizætiøn 💩": state["Iñtërnâtiônàlizætiøn 💩"] + 1,
            },
          }),
        ],
      ],
      onArg: fail,
      onRest: fail,
    }
  );

  expect(result).toMatchInlineSnapshot(`
    Object {
      "state": Object {
        "#": 1,
        "9": 2,
        "?": 1,
        "Iñtërnâtiônàlizætiøn 💩": 1,
        "d": Array [
          "-h",
          "o=o",
        ],
        "dashed-NAME": Array [
          "--help",
          "[ weird, thing ]",
        ],
        "h": 1,
        "help": 1,
        "longH": 1,
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
  const result = parse<null, never, string>(["arg"], {
    initialState: null,
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

test("handling remaining as rest can also give rest error", () => {
  const result = parse<null, never, number>(["arg"], {
    initialState: null,
    flagRulesFromState: () => [],
    onArg: (_, state) => ({ tag: "Ok", state, handleRemainingAsRest: true }),
    onRest: () => ({
      tag: "Error",
      error: 5,
    }),
  });

  expect(result).toMatchInlineSnapshot(`
    Object {
      "error": 5,
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

test("-- to stop flags parsing", () => {
  type State = {
    a: number;
    args: Array<string>;
    rest: Array<string>;
  };

  const result = parse<State>(["-a", "b", "--", "-a", "b"], {
    initialState: {
      a: 0,
      args: [],
      rest: [],
    },
    flagRulesFromState: () => [
      [["-a"], (state) => ({ tag: "Ok", state: { ...state, a: state.a + 1 } })],
    ],
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
        "a": 1,
        "args": Array [
          "b",
        ],
        "rest": Array [
          "-a",
          "b",
        ],
      },
      "tag": "Ok",
    }
  `);
});

test("-- can be consumed without stopping flags parsing", () => {
  type State = {
    a: Array<string>;
    args: Array<string>;
    rest: Array<string>;
  };

  const result = parse<State>(["b", "-a", "--", "-a", "b"], {
    initialState: {
      a: [],
      args: [],
      rest: [],
    },
    flagRulesFromState: () => [
      [
        ["-a"],
        "a value",
        (value, state) => ({
          tag: "Ok",
          state: { ...state, a: state.a.concat(value) },
        }),
      ],
    ],
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
        "a": Array [
          "--",
          "b",
        ],
        "args": Array [
          "b",
        ],
        "rest": Array [],
      },
      "tag": "Ok",
    }
  `);
});

test("-- can give empty array", () => {
  const result = parse<undefined | Array<string>>(["--"], {
    initialState: undefined,
    flagRulesFromState: () => [],
    onArg: fail,
    onRest: (rest) => ({
      tag: "Ok",
      state: rest,
    }),
  });

  expect(result).toMatchInlineSnapshot(`
    Object {
      "state": Array [],
      "tag": "Ok",
    }
  `);
});

test("handling remaining as rest can give empty array", () => {
  const result = parse<undefined | Array<string>>(["arg"], {
    initialState: undefined,
    flagRulesFromState: () => [],
    onArg: (_, state) => ({
      tag: "Ok",
      state,
      handleRemainingAsRest: true,
    }),
    onRest: (rest) => ({
      tag: "Ok",
      state: rest,
    }),
  });

  expect(result).toMatchInlineSnapshot(`
    Object {
      "state": Array [],
      "tag": "Ok",
    }
  `);
});

test("non-flags", () => {
  type State = {
    args: Array<string>;
  };

  const result = parse<State>(["---", "--=", "-="], {
    initialState: {
      args: [],
    },
    flagRulesFromState: () => [],
    onArg: (arg, state) => ({
      tag: "Ok",
      state: { ...state, args: state.args.concat(arg) },
    }),
    onRest: fail,
  });

  expect(result).toMatchInlineSnapshot(`
    Object {
      "state": Object {
        "args": Array [
          "---",
          "--=",
          "-=",
        ],
      },
      "tag": "Ok",
    }
  `);
});

test("flags that never match anything", () => {
  const result = parse(["-help", "help"], {
    initialState: null,
    flagRulesFromState: () => [
      [["-help"], fail],
      [["help"], fail],
    ],
    onArg: fail,
    onRest: fail,
  });

  expect(result).toMatchInlineSnapshot(`
    Object {
      "error": Object {
        "name": "-h",
        "tag": "UnknownFlag",
      },
      "tag": "FlagError",
    }
  `);
});

test("unexpected flag value for short flag", () => {
  const result = parse(["-h=value"], {
    initialState: 0,
    flagRulesFromState: () => [
      [["-h"], (state) => ({ tag: "Ok", state: state + 1 })],
    ],
    onArg: fail,
    onRest: fail,
  });

  expect(result).toMatchInlineSnapshot(`
    Object {
      "error": Object {
        "name": "-h",
        "tag": "UnexpectedFlagValue",
        "value": "value",
      },
      "tag": "FlagError",
    }
  `);
});

test("unexpected flag value for long flag", () => {
  const result = parse(["--help=value"], {
    initialState: 0,
    flagRulesFromState: () => [
      [["--help"], (state) => ({ tag: "Ok", state: state + 1 })],
    ],
    onArg: fail,
    onRest: fail,
  });

  expect(result).toMatchInlineSnapshot(`
    Object {
      "error": Object {
        "name": "--help",
        "tag": "UnexpectedFlagValue",
        "value": "value",
      },
      "tag": "FlagError",
    }
  `);
});

test("missing flag value", () => {
  const result = parse(["--file"], {
    initialState: "",
    flagRulesFromState: () => [
      [
        ["--file"],
        "a path",
        (path: string) => ({ tag: "Ok" as const, state: path }),
      ],
    ],
    onArg: fail,
    onRest: fail,
  });

  expect(result).toMatchInlineSnapshot(`
    Object {
      "error": Object {
        "name": "--file",
        "tag": "MissingFlagValue",
        "valueDescription": "a path",
      },
      "tag": "FlagError",
    }
  `);
});

test("custom flag error for boolean flag", () => {
  const result = parse(["--help"], {
    initialState: "",
    flagRulesFromState: () => [
      [["--help"], () => ({ tag: "Error", error: 1337 })],
    ],
    onArg: fail,
    onRest: fail,
  });

  expect(result).toMatchInlineSnapshot(`
    Object {
      "error": Object {
        "error": 1337,
        "name": "--help",
        "tag": "Custom",
        "valueDescription": undefined,
      },
      "tag": "FlagError",
    }
  `);
});

test("custom flag error for value flag", () => {
  type FlagError = { tag: "PathError" };
  const result = parse<string, FlagError>(["--file=/path"], {
    initialState: "",
    flagRulesFromState: () => [
      [
        ["--file"],
        "a path",
        () => ({ tag: "Error" as const, error: { tag: "PathError" as const } }),
      ],
    ],
    onArg: fail,
    onRest: fail,
  });

  expect(result).toMatchInlineSnapshot(`
    Object {
      "error": Object {
        "error": Object {
          "tag": "PathError",
        },
        "name": "--file",
        "tag": "Custom",
        "valueDescription": "a path",
      },
      "tag": "FlagError",
    }
  `);
});
