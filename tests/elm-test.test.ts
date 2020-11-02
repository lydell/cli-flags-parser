import parse, { FlagErrorWrapper, FlagRule } from "../index";

type IntermediateCommand = "help" | "init" | "install" | "make" | "test";

type Command =
  | { tag: "help" }
  | { tag: "version" }
  | { tag: "init" }
  | {
      tag: "install";
      packageName: string;
      compiler: string | undefined;
    }
  | {
      tag: "make";
      testFileGlobs: Array<string>;
      report: Report;
      compiler: string | undefined;
    }
  | {
      tag: "test";
      testFileGlobs: Array<string>;
      report: Report;
      fuzz: number;
      seed: number;
      watch: boolean;
      compiler: string | undefined;
    };

type State = {
  command: IntermediateCommand;
  args: Array<string>;
  compiler: string | undefined;
  report: Report;
  fuzz: number;
  seed: number;
  help: boolean;
  version: boolean;
  watch: boolean;
};

type Rule = FlagRule<State, string>;

const helpRule: Rule = [
  ["--help", "-h"],
  (state) => ({
    tag: "Ok",
    state: { ...state, help: true },
    handleRemainingAsRest: true,
  }),
];

const versionRule: Rule = [
  ["--version"],
  (state) => ({ tag: "Ok", state: { ...state, version: true } }),
];

const compilerRule: Rule = [
  ["--compiler"],
  "a path to an Elm executable",
  (value: string, state: State) => ({
    tag: "Ok" as const,
    state: { ...state, compiler: value },
  }),
];

const reportRule: Rule = [
  ["--report"],
  "a reporter",
  (value: string, state: State) => {
    const result = parseReport(value);
    switch (result.tag) {
      case "Ok":
        return {
          tag: "Ok" as const,
          state: { ...state, report: result.value },
        };
      case "Error":
        return result;
    }
  },
];

const fuzzRule: Rule = [
  ["--fuzz"],
  "a number",
  (value: string, state: State) => {
    const result = parsePositiveInteger(value);
    switch (result.tag) {
      case "Ok":
        return {
          tag: "Ok" as const,
          state: { ...state, fuzz: result.value },
        };
      case "Error":
        return result;
    }
  },
];

const seedRule: Rule = [
  ["--seed"],
  "a number",
  (value: string, state: State) => {
    const result = parsePositiveInteger(value);
    switch (result.tag) {
      case "Ok":
        return {
          tag: "Ok" as const,
          state: { ...state, seed: result.value },
        };
      case "Error":
        return result;
    }
  },
];

const watchRule: Rule = [
  ["--watch"],
  (state) => ({ tag: "Ok", state: { ...state, watch: true } }),
];

const allRules = [
  helpRule,
  versionRule,
  compilerRule,
  reportRule,
  fuzzRule,
  seedRule,
  watchRule,
];

type Result<Error, Value> =
  | { tag: "Ok"; value: Value }
  | { tag: "Error"; error: Error };

function parsePositiveInteger(string: string): Result<string, number> {
  const number = Number(string);
  return !/^\d+$/.test(string)
    ? {
        tag: "Error",
        error: `Expected one or more digits, but got: ${string}`,
      }
    : !Number.isFinite(number)
    ? {
        tag: "Error",
        error: `Expected a finite number, but got: ${number}`,
      }
    : { tag: "Ok", value: number };
}

type Report = "console" | "json" | "junit";

function parseReport(string: string): Result<string, Report> {
  switch (string) {
    case "console":
    case "json":
    case "junit":
      return { tag: "Ok", value: string };
    default:
      return {
        tag: "Error",
        error: `Expected console, json or junit, but got: ${string}`,
      };
  }
}

function parseCommand(state: State): Result<string, Command> {
  if (state.help) {
    return { tag: "Ok", value: { tag: "help" } };
  }

  if (state.version) {
    return { tag: "Ok", value: { tag: "version" } };
  }

  const got = `${state.args.length}: ${state.args.join(" ")}`;

  switch (state.command) {
    case "help":
      return { tag: "Ok", value: { tag: "help" } };

    case "test":
      return {
        tag: "Ok",
        value: {
          tag: "test",
          testFileGlobs: state.args,
          fuzz: state.fuzz,
          seed: state.seed,
          report: state.report,
          watch: state.watch,
          compiler: state.compiler,
        },
      };

    case "init":
      return state.args.length > 0
        ? { tag: "Error", error: `init takes no arguments, but got ${got}` }
        : { tag: "Ok", value: { tag: "init" } };

    case "install":
      return state.args.length === 0
        ? {
            tag: "Error",
            error:
              "You need to provide the package you want to install. For example: elm-test install elm/regex",
          }
        : state.args.length === 1
        ? {
            tag: "Ok",
            value: {
              tag: "install",
              packageName: state.args[0],
              compiler: state.compiler,
            },
          }
        : {
            tag: "Error",
            error: `install takes one single argument, but got ${got}`,
          };

    case "make":
      return {
        tag: "Ok",
        value: {
          tag: "make",
          testFileGlobs: state.args,
          report: state.report,
          compiler: state.compiler,
        },
      };
  }
}

function flagRulesFromState(state: State): Array<Rule> {
  const common = [helpRule, versionRule, compilerRule];

  switch (state.command) {
    case "help":
      return [];

    case "init":
      return common;

    case "install":
      return common;

    case "make":
      return [...common, reportRule];

    case "test":
      return [...common, reportRule, fuzzRule, seedRule, watchRule];
  }
}

function elmTest(
  argv: Array<string>,
  { initialCommand = "test" }: { initialCommand?: IntermediateCommand } = {}
): Command | string {
  const initialState: State = {
    command: initialCommand,
    args: [],
    compiler: undefined,
    report: "console",
    fuzz: 100,
    seed: 1337,
    help: false,
    version: false,
    watch: false,
  };

  const result = parse(argv, {
    initialState,
    flagRulesFromState,
    onArg: (arg, state) => {
      if (state.command === initialCommand && state.args.length === 0) {
        switch (arg) {
          case "help":
            return {
              tag: "Ok",
              state: { ...state, command: "help" as const },
              handleRemainingAsRest: true,
            };
          case "init":
          case "install":
          case "make":
            return {
              tag: "Ok",
              state: { ...state, command: arg },
            };
          default:
            return {
              tag: "Ok",
              state: {
                ...state,
                command: "test" as const,
                args: state.args.concat(arg),
              },
            };
        }
      } else {
        return {
          tag: "Ok",
          state: { ...state, args: state.args.concat(arg) },
        };
      }
    },
    onRest: (rest, state) => ({
      tag: "Ok",
      state: { ...state, args: state.args.concat(rest) },
    }),
  });

  switch (result.tag) {
    case "Ok": {
      if (
        initialCommand === "test" &&
        result.state.command !== initialCommand
      ) {
        // Re-parse with the found command as the starting point to disallow
        // incompatible flags given before the command itself.
        return elmTest(argv, { initialCommand: result.state.command });
      }
      const result2 = parseCommand(result.state);
      switch (result2.tag) {
        case "Ok":
          return result2.value;
        case "Error":
          return result2.error;
      }
    }

    case "FlagError":
      return `${result.error.name}: ${flagErrorToString(result.error)}`;

    case "ArgError":
      return result.error;
  }
}

function flagErrorToString(error: FlagErrorWrapper<string>): string {
  switch (error.tag) {
    case "UnknownFlag":
      return allRules.some(([name]) => name.includes(error.name))
        ? "Invalid flag in this context"
        : "Unknown flag";
    case "MissingFlagValue":
      return `This flag requires ${error.valueDescription}`;
    case "ValueFlagNotLastInGroup":
      return `This flag requires ${error.valueDescription}. Only the last flag in a group can have a value.`;
    case "UnexpectedFlagValue":
      return `This flag takes no value but was given one: ${error.value}`;
    case "Custom":
      return error.error;
  }
}

describe("elm-test", () => {
  test("--help", () => {
    expect(elmTest(["--help"])).toMatchInlineSnapshot(`
      Object {
        "tag": "help",
      }
    `);
  });

  test("-h", () => {
    expect(elmTest(["-h"])).toMatchInlineSnapshot(`
      Object {
        "tag": "help",
      }
    `);
  });

  test("-help", () => {
    expect(elmTest(["-help"])).toMatchInlineSnapshot(`
      Object {
        "tag": "help",
      }
    `);
  });

  test("help", () => {
    expect(elmTest(["help"])).toMatchInlineSnapshot(`
      Object {
        "tag": "help",
      }
    `);
  });

  test("--help with command", () => {
    expect(elmTest(["install", "--help"])).toMatchInlineSnapshot(`
      Object {
        "tag": "help",
      }
    `);
  });

  test("--help with unknown flag (ignores the flag)", () => {
    expect(elmTest(["--help", "--unknown"])).toMatchInlineSnapshot(`
      Object {
        "tag": "help",
      }
    `);
  });

  test("--version", () => {
    expect(elmTest(["--version"])).toMatchInlineSnapshot(`
      Object {
        "tag": "version",
      }
    `);
  });

  test("make with --seed", () => {
    expect(elmTest(["make", "--seed=123"])).toMatchInlineSnapshot(
      `"--seed: Invalid flag in this context"`
    );
  });

  test("--seed with make", () => {
    expect(elmTest(["--seed=123", "make"])).toMatchInlineSnapshot(
      `"--seed: Invalid flag in this context"`
    );
  });

  test("--seed without value", () => {
    expect(elmTest(["--seed"])).toMatchInlineSnapshot(
      `"--seed: This flag requires a number"`
    );
  });

  test("--seed with bad value", () => {
    expect(elmTest(["--seed", "0xaf"])).toMatchInlineSnapshot(
      `"--seed: Expected one or more digits, but got: 0xaf"`
    );
  });

  test("valid --seed", () => {
    expect(elmTest(["--seed", "1234"])).toMatchInlineSnapshot(`
      Object {
        "compiler": undefined,
        "fuzz": 100,
        "report": "console",
        "seed": 1234,
        "tag": "test",
        "testFileGlobs": Array [],
        "watch": false,
      }
    `);
  });

  test("--watch", () => {
    expect(elmTest(["--watch", "src"])).toMatchInlineSnapshot(`
      Object {
        "compiler": undefined,
        "fuzz": 100,
        "report": "console",
        "seed": 1337,
        "tag": "test",
        "testFileGlobs": Array [
          "src",
        ],
        "watch": true,
      }
    `);
  });

  test("--watch with value", () => {
    expect(elmTest(["--watch=src"])).toMatchInlineSnapshot(
      `"--watch: This flag takes no value but was given one: src"`
    );
  });

  test("init", () => {
    expect(elmTest(["init"])).toMatchInlineSnapshot(`
      Object {
        "tag": "init",
      }
    `);
  });

  test("run tests in init/ folder", () => {
    expect(elmTest(["--", "init"])).toMatchInlineSnapshot(`
      Object {
        "compiler": undefined,
        "fuzz": 100,
        "report": "console",
        "seed": 1337,
        "tag": "test",
        "testFileGlobs": Array [
          "init",
        ],
        "watch": false,
      }
    `);
  });
});
