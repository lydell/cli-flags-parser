type Dash = "-" | "--";

type FlagRule<Error> =
  | [Dash, string, "switch", Callback<void, Error>]
  | [Dash, string, "value", Callback<string, Error>];

type FlagError =
  | {
      tag: "ValueSuppliedToSwitch";
      dash: Dash;
      name: string;
      value: string;
    }
  | {
      tag: "MissingValue";
      dash: Dash;
      name: string;
    }
  | {
      tag: "UnknownFlag";
      dash: Dash;
      name: string;
    };

type Callback<Arg, Error> = (
  arg: Arg
) =>
  | { tag: "NewFlagRules"; rules: Array<FlagRule<Error>> }
  | { tag: "Error"; error: Error }
  | undefined;

type Options<Error> = {
  initialFlagRules: Array<FlagRule<Error>>;
  onArg: Callback<string, Error>;
  onRest: (rest: Array<string>) => void;
};

const longOption = /^--([^-=][^=]*)(?:=([^]*))?$/;

export default function parse<Error>(
  argv: Array<string>,
  options: Options<Error>
):
  | { tag: "Ok" }
  | { tag: "FlagError"; error: FlagError }
  | { tag: "CustomError"; error: Error } {
  let rules = options.initialFlagRules;

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--") {
      options.onRest(argv.slice(index + 1));
      break;
    }

    const longOptionMatch = longOption.exec(arg);
    if (longOptionMatch !== null) {
      const argName: string = longOptionMatch[1];
      const maybeValue: string | undefined = longOptionMatch[2];
      let foundMatch = false;

      const getValue = (): string | undefined => {
        if (maybeValue !== undefined) {
          return maybeValue;
        } else {
          index++;
          return index < argv.length ? argv[index] : undefined;
        }
      };

      for (const rule of rules) {
        const [dash, name] = rule;
        if (dash === "--" && name === argName) {
          switch (rule[2]) {
            case "switch": {
              if (maybeValue !== undefined) {
                return {
                  tag: "FlagError",
                  error: {
                    tag: "ValueSuppliedToSwitch",
                    dash,
                    name,
                    value: maybeValue,
                  },
                };
              }
              const callback = rule[3];
              const result = callback(undefined);
              if (result === undefined) {
                break;
              }
              switch (result.tag) {
                case "NewFlagRules":
                  ({ rules } = result);
                  break;
                case "Error":
                  return {
                    tag: "CustomError",
                    error: result.error,
                  };
              }
              break;
            }

            case "value": {
              const value = getValue();
              if (value === undefined) {
                return {
                  tag: "FlagError",
                  error: {
                    tag: "MissingValue",
                    dash,
                    name,
                  },
                };
              }
              const callback = rule[3];
              const result = callback(value);
              if (result === undefined) {
                break;
              }
              switch (result.tag) {
                case "NewFlagRules":
                  ({ rules } = result);
                  break;
                case "Error":
                  return {
                    tag: "CustomError",
                    error: result.error,
                  };
              }
              break;
            }
          }
          foundMatch = true;
          break;
        }
      }

      if (!foundMatch) {
        return {
          tag: "FlagError",
          error: {
            tag: "UnknownFlag",
            dash: "--",
            name: argName,
          },
        };
      }
    }
  }

  return { tag: "Ok" };
}
