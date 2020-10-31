import parse, { FlagRule } from "../index";

type IntermediateCommand = "none" | "init" | "install" | "make" | "test";

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

type Options = {
  compiler: string | undefined;
  report: Report;
  fuzz: number;
  seed: number;
  help: boolean;
  version: boolean;
  watch: boolean;
};

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

const helpRule = (options: Options): FlagRule<CustomError> => [
  "--",
  "help",
  "switch",
  () => {
    options.help = true;
  },
];

const versionRule = (options: Options): FlagRule<CustomError> => [
  "--",
  "version",
  "switch",
  () => {
    options.version = true;
  },
];

const compilerRule = (options: Options): FlagRule<CustomError> => [
  "--",
  "compiler",
  "value",
  (value: string) => {
    options.compiler = value;
  },
];

const reportRule = (options: Options): FlagRule<CustomError> => [
  "--",
  "report",
  "value",
  (value: string) => {
    const result = parseReport(value);
    switch (result.tag) {
      case "Ok":
        options.report = result.value;
        return undefined;
      case "Error":
        return {
          tag: "Error" as const,
          error: `--report requires a known reporter: ${result.error}`,
        };
    }
  },
];

const fuzzRule = (options: Options): FlagRule<CustomError> => [
  "--",
  "fuzz",
  "value",
  (value: string) => {
    const result = parsePositiveInteger(value);
    switch (result.tag) {
      case "Ok":
        options.fuzz = result.value;
        return undefined;
      case "Error":
        return {
          tag: "Error" as const,
          error: `--fuzz requires a number: ${result.error}`,
        };
    }
  },
];

const seedRule = (options: Options): FlagRule<CustomError> => [
  "--",
  "seed",
  "value",
  (value: string) => {
    const result = parsePositiveInteger(value);
    switch (result.tag) {
      case "Ok":
        options.seed = result.value;
        return undefined;
      case "Error":
        return {
          tag: "Error" as const,
          error: `--seed requires a number: ${result.error}`,
        };
    }
  },
];

const watchRule = (options: Options): FlagRule<CustomError> => [
  "--",
  "watch",
  "switch",
  () => {
    options.watch = true;
  },
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

function getRulesFromCommand(
  command: IntermediateCommand,
  options: Options
): Array<FlagRule<CustomError>> {
  const common = [
    helpRule(options),
    versionRule(options),
    compilerRule(options),
  ];
  switch (command) {
    case "none":
      return common;

    case "init":
      return common;

    case "install":
      return common;

    case "make":
      return [...common, reportRule(options)];

    case "test":
      return [
        ...common,
        reportRule(options),
        fuzzRule(options),
        seedRule(options),
        watchRule(options),
      ];
  }
}

function parseCommand(
  command: IntermediateCommand,
  args: Array<string>,
  options: Options
): Result<string, Command> {
  if (options.help || (command === "none" && args[0] === "help")) {
    return { tag: "Ok", value: { tag: "help" } };
  }

  if (options.version) {
    return { tag: "Ok", value: { tag: "version" } };
  }

  const got = `${args.length}: ${args.join(" ")}`;

  switch (command) {
    case "none":
    case "test":
      return {
        tag: "Ok",
        value: {
          tag: "test",
          testFileGlobs: args,
          fuzz: options.fuzz,
          seed: options.seed,
          report: options.report,
          watch: options.watch,
          compiler: options.compiler,
        },
      };

    case "init":
      return args.length > 0
        ? { tag: "Error", error: `init takes no arguments, but got ${got}` }
        : { tag: "Ok", value: { tag: "init" } };

    case "install":
      return args.length === 0
        ? {
            tag: "Error",
            error:
              "You need to provide the package you want to install. For example: elm-test install elm/regex",
          }
        : args.length === 1
        ? {
            tag: "Ok",
            value: {
              tag: "install",
              packageName: args[0],
              compiler: options.compiler,
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
          testFileGlobs: args,
          report: options.report,
          compiler: options.compiler,
        },
      };
  }
}

function elmTest(argv: Array<string>): Command | string {
  const options: Options = {
    compiler: undefined,
    report: "console",
    fuzz: 100,
    seed: 1337,
    help: false,
    version: false,
    watch: false,
  };
  const allKnownOptionNames: Array<string> = allRules.map(
    (rule) => rule(options)[1]
  );

  let command: IntermediateCommand = "none";
  const args: Array<string> = [];

  const result = parse(argv, {
    initialFlagRules: getRulesFromCommand(command, options),
    onArg: (arg) => {
      if (command === undefined) {
        switch (arg) {
          case "init":
          case "install":
          case "make":
            command = arg;
            break;
          default:
            command = "test";
            args.push(arg);
        }
      }
      return {
        tag: "NewFlagRules",
        rules: getRulesFromCommand(command, options),
      };
    },
    onRest: (rest) => {
      args.push(...rest);
    },
  });

  switch (result.tag) {
    case "Ok": {
      const result2 = parseCommand(command, args, options);
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
          return allKnownOptionNames.includes(result.error.name)
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
