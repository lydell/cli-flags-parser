import parse, { FlagRule } from "../index";

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

type CustomError = string;

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

const helpRule: FlagRule<State, CustomError> = [
  "--",
  "help",
  (state) => ({
    tag: "Ok",
    state: { ...state, help: true },
    handleRemainingAsRest: true,
  }),
];

const versionRule: FlagRule<State, CustomError> = [
  "--",
  "version",
  (state) => ({ tag: "Ok", state: { ...state, version: true } }),
];

const compilerRule: FlagRule<State, CustomError> = [
  "--",
  "compiler",
  "=",
  (state: State, value: string) => ({
    tag: "Ok" as const,
    state: { ...state, compiler: value },
  }),
];

const reportRule: FlagRule<State, CustomError> = [
  "--",
  "report",
  "=",
  (state: State, value: string) => {
    const result = parseReport(value);
    switch (result.tag) {
      case "Ok":
        return {
          tag: "Ok" as const,
          state: { ...state, report: result.value },
        };
      case "Error":
        return {
          tag: "Error" as const,
          error: `--report requires a known reporter: ${result.error}`,
        };
    }
  },
];

const fuzzRule: FlagRule<State, CustomError> = [
  "--",
  "fuzz",
  "=",
  (state: State, value: string) => {
    const result = parsePositiveInteger(value);
    switch (result.tag) {
      case "Ok":
        return {
          tag: "Ok" as const,
          state: { ...state, fuzz: result.value },
        };
      case "Error":
        return {
          tag: "Error" as const,
          error: `--fuzz requires a number: ${result.error}`,
        };
    }
  },
];

const seedRule: FlagRule<State, CustomError> = [
  "--",
  "seed",
  "=",
  (state: State, value: string) => {
    const result = parsePositiveInteger(value);
    switch (result.tag) {
      case "Ok":
        return {
          tag: "Ok" as const,
          state: { ...state, seed: result.value },
        };
      case "Error":
        return {
          tag: "Error" as const,
          error: `--seed requires a number: ${result.error}`,
        };
    }
  },
];

const watchRule: FlagRule<State, CustomError> = [
  "--",
  "watch",
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

function flagRulesFromState(state: State): Array<FlagRule<State, CustomError>> {
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

function elmTest(argv: Array<string>): Command | string {
  const initialState: State = {
    command: "test",
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
    onArg: (state, arg) => {
      if (state.command === "test" && state.args.length === 0) {
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
    onRest: (state, rest) => ({
      tag: "Ok",
      state: { ...state, args: state.args.concat(rest) },
    }),
  });

  switch (result.tag) {
    case "Ok": {
      const result2 = parseCommand(result.state);
      switch (result2.tag) {
        case "Ok":
          return result2.value;
        case "Error":
          return result2.error;
      }
    }

    case "FlagError":
      switch (result.error.tag) {
        case "UnknownFlag":
          return allRules.some(([, name]) => name === result.error.name)
            ? `Invalid flag in this context: ${result.error.dash}${result.error.name}`
            : `Unknown flag: ${result.error.dash}${result.error.name}`;
        case "MissingValue":
          return `This flag requires a value: ${result.error.dash}${result.error.name}`;
        case "ValueFlagNotLastInGroup":
          return `This flag requires a value and must be last in the group: ${result.error.dash}${result.error.name}`;
        case "ValueSuppliedToSwitch":
          return `This flag takes no value but was given one: ${result.error.dash}${result.error.name}=${result.error.value}`;
      }

    case "CustomError":
      return result.error;
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

  test("--seed with make", () => {
    expect(elmTest(["make", "--seed=123"])).toMatchInlineSnapshot(
      `"Invalid flag in this context: --seed"`
    );
  });
});
