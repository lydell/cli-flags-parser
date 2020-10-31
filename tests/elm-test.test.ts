import parse, { FlagRule } from "../index";

type Command = "init" | "install" | "make" | "test";

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
        message: `Expected console, json or junit, but got: ${string}`,
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
          error: `--report requires a known reporter: ${result.message}`,
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
          error: `--fuzz requires a number: ${result.message}`,
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
          error: `--seed requires a number: ${result.message}`,
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
  | { tag: "Error"; message: Error };

function parsePositiveInteger(string: string): Result<string, number> {
  const number = Number(string);
  return !/^\d+$/.test(string)
    ? {
        tag: "Error",
        message: `Expected one or more digits, but got: ${string}`,
      }
    : !Number.isFinite(number)
    ? {
        tag: "Error",
        message: `Expected a finite number, but got: ${number}`,
      }
    : { tag: "Ok", value: number };
}

function getRulesFromCommand(
  command: Command | undefined,
  options: Options
): Array<FlagRule<CustomError>> {
  const common = [
    helpRule(options),
    versionRule(options),
    compilerRule(options),
  ];
  switch (command) {
    case undefined:
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

function elmTest(argv: Array<string>): string {
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

  let command: Command | undefined = undefined;
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
    case "Ok":
      return `elm-test ${command ?? "test"} ${args.join(" ")} ${JSON.stringify(
        options
      )}`;

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
          return `This flags takes no value but was given one: ${result.error.dash}${result.error.name}=${result.error.value}`;
      }

    case "CustomError":
      return `CustomError: ${result.error}`;
  }
}

describe("elm-test", () => {
  test("--help", () => {
    expect(elmTest(["--help"])).toMatchInlineSnapshot(
      // TODO: Parse fully and better return type.
      `"elm-test test  {\\"report\\":\\"console\\",\\"fuzz\\":100,\\"seed\\":1337,\\"help\\":true,\\"version\\":false,\\"watch\\":false}"`
    );
  });
});
