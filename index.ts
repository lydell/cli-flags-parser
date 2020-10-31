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
      tag: "ValueFlagNotLastInGroup";
      dash: "-";
      name: string;
    }
  | {
      tag: "UnknownFlag";
      dash: Dash;
      name: string;
    };

type FlagValue =
  | { tag: "ViaEquals"; value: string }
  | { tag: "NotLastInGroup" }
  | { tag: "ViaNextArg"; value: string }
  | { tag: "NextArgMissing" };

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

const optionRegex = /^(--?)([^-=][^=]*)(?:=([^]*))?$/;

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

    const match = optionRegex.exec(arg);
    if (match !== null) {
      const flagDash: Dash = match[1] === "-" ? "-" : "--";
      const beforeEquals: string = match[2];
      const maybeAfterEquals: string | undefined = match[3];

      const afterEquals: FlagValue =
        maybeAfterEquals === undefined
          ? index < argv.length - 1
            ? { tag: "ViaNextArg", value: argv[index + 1] }
            : { tag: "NextArgMissing" }
          : { tag: "ViaEquals", value: maybeAfterEquals };

      const items: Array<[string, FlagValue]> =
        flagDash === "-"
          ? beforeEquals
              .split("")
              .map((char, charIndex, array) => [
                char,
                charIndex === array.length - 1
                  ? afterEquals
                  : { tag: "NotLastInGroup" },
              ])
          : [[beforeEquals, afterEquals]];

      for (const [flagName, flagValue] of items) {
        let foundMatch = false;

        for (const rule of rules) {
          const [dash, name] = rule;
          if (dash === flagDash && name === flagName) {
            switch (rule[2]) {
              case "switch": {
                switch (flagValue.tag) {
                  case "ViaEquals":
                  case "ViaNextArg":
                    return {
                      tag: "FlagError",
                      error: {
                        tag: "ValueSuppliedToSwitch",
                        dash,
                        name,
                        value: flagValue.value,
                      },
                    };
                  case "NextArgMissing":
                  case "NotLastInGroup":
                    // Continue below.
                    break;
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
                let value;
                switch (flagValue.tag) {
                  case "ViaEquals":
                  case "ViaNextArg":
                    ({ value } = flagValue);
                    break;
                  case "NotLastInGroup":
                    return {
                      tag: "FlagError",
                      error: {
                        tag: "ValueFlagNotLastInGroup",
                        dash: "-",
                        name,
                      },
                    };
                  case "NextArgMissing":
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
              name: flagName,
            },
          };
        }
      }
    } else {
      const result = options.onArg(arg);
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
    }
  }

  return { tag: "Ok" };
}
