export type Dash = "-" | "--";

export type FlagRule<State, CustomError> =
  | [Dash, string, Callback<void, State, CustomError>]
  | [Dash, string, "=", Callback<string, State, CustomError>];

export type FlagError =
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

export type Callback<Arg, State, CustomError> = (
  arg: Arg,
  state: State
) =>
  | { tag: "Ok"; state: State; handleRemainingAsRest?: boolean }
  | { tag: "Error"; error: CustomError };

export type Options<State, CustomError> = {
  initialState: State;
  flagRulesFromState: (state: State) => Array<FlagRule<State, CustomError>>;
  onArg: Callback<string, State, CustomError>;
  onRest: Callback<Array<string>, State, CustomError>;
};

export type ParseResult<State, CustomError> =
  | { tag: "Ok"; state: State }
  | { tag: "FlagError"; error: FlagError }
  | { tag: "CustomError"; error: CustomError };

const optionRegex = /^(--?)([^-=][^=]*)(?:=([^]*))?$/;

export default function parse<State, CustomError>(
  argv: Array<string>,
  options: Options<State, CustomError>
): ParseResult<State, CustomError> {
  let state = options.initialState;
  let rules = options.flagRulesFromState(state);

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];

    const handleRemainingAsRest = (): ParseResult<State, CustomError> => {
      const result = options.onRest(argv.slice(index + 1), state);
      switch (result.tag) {
        case "Ok":
          return { tag: "Ok", state: result.state };
        case "Error":
          return { tag: "CustomError", error: result.error };
      }
    };

    const handleCallbackResult = (
      result: ReturnType<Callback<unknown, State, CustomError>>
    ): ParseResult<State, CustomError> | undefined => {
      switch (result.tag) {
        case "Ok":
          ({ state } = result);
          rules = options.flagRulesFromState(state);
          return result.handleRemainingAsRest === true
            ? handleRemainingAsRest()
            : undefined;
        case "Error":
          return {
            tag: "CustomError",
            error: result.error,
          };
      }
    };

    if (arg === "--") {
      return handleRemainingAsRest();
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
            if (rule.length === 3) {
              switch (flagValue.tag) {
                case "ViaEquals":
                  return {
                    tag: "FlagError",
                    error: {
                      tag: "ValueSuppliedToSwitch",
                      dash,
                      name,
                      value: flagValue.value,
                    },
                  };
                case "ViaNextArg":
                case "NextArgMissing":
                case "NotLastInGroup": {
                  const callback = rule[2];
                  const result = handleCallbackResult(
                    callback(undefined, state)
                  );
                  if (result !== undefined) {
                    return result;
                  }
                }
              }
            } else {
              const callback = rule[3];
              switch (flagValue.tag) {
                // @ts-expect-error: Fallthrough intended.
                case "ViaNextArg":
                  index++;
                case "ViaEquals": {
                  const result = handleCallbackResult(
                    callback(flagValue.value, state)
                  );
                  if (result !== undefined) {
                    return result;
                  }
                  break;
                }
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
      const result = handleCallbackResult(options.onArg(arg, state));
      if (result !== undefined) {
        return result;
      }
    }
  }

  return { tag: "Ok", state };
}
