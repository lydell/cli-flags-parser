export type Dash = "-" | "--";

export type FlagRule<State, CustomFlagError> =
  | [Dash, string, Callback<void, State, CustomFlagError>]
  | [Dash, string, "=", Callback<string, State, CustomFlagError>];

export type FlagError<CustomFlagError> =
  | {
      tag: "UnexpectedFlagValue";
      dash: Dash;
      name: string;
      value: string;
    }
  | {
      tag: "MissingFlagValue";
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
    }
  | {
      tag: "Custom";
      dash: Dash;
      name: string;
      error: CustomFlagError;
    };

type FlagValue =
  | { tag: "ViaEquals"; value: string }
  | { tag: "NotLastInGroup" }
  | { tag: "ViaNextArg"; value: string }
  | { tag: "NextArgMissing" };

type Callback<Arg, State, CustomError> = (
  state: State,
  arg: Arg
) =>
  | { tag: "Ok"; state: State; handleRemainingAsRest?: boolean }
  | { tag: "Error"; error: CustomError };

export type Options<State, CustomFlagError, CustomError> = {
  initialState: State;
  flagRulesFromState: (state: State) => Array<FlagRule<State, CustomFlagError>>;
  onArg: Callback<string, State, CustomError>;
  onRest: Callback<Array<string>, State, CustomError>;
};

export type ParseResult<State, CustomFlagError, CustomError> =
  | { tag: "Ok"; state: State }
  | { tag: "FlagError"; error: FlagError<CustomFlagError> }
  | { tag: "CustomError"; error: CustomError };

const optionRegex = /^(--?)([^-=][^=]*)(?:=([^]*))?$/;

export default function parse<
  State,
  CustomFlagError = never,
  CustomError = never
>(
  argv: Array<string>,
  options: Options<State, CustomFlagError, CustomError>
): ParseResult<State, CustomFlagError, CustomError> {
  let state = options.initialState;
  let rules = options.flagRulesFromState(state);

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];

    const handleRemainingAsRest = (): ParseResult<
      State,
      CustomFlagError,
      CustomError
    > => {
      const result = options.onRest(state, argv.slice(index + 1));
      switch (result.tag) {
        case "Ok":
          return { tag: "Ok", state: result.state };
        case "Error":
          return { tag: "CustomError", error: result.error };
      }
    };

    const handleFlagCallbackResult = (
      dash: Dash,
      name: string,
      result: ReturnType<Callback<unknown, State, CustomFlagError>>
    ): ParseResult<State, CustomFlagError, CustomError> | undefined => {
      switch (result.tag) {
        case "Ok":
          ({ state } = result);
          rules = options.flagRulesFromState(state);
          return result.handleRemainingAsRest === true
            ? handleRemainingAsRest()
            : undefined;
        case "Error":
          return {
            tag: "FlagError",
            error: {
              tag: "Custom",
              dash,
              name,
              error: result.error,
            },
          };
      }
    };

    const handleCallbackResult = (
      result: ReturnType<Callback<unknown, State, CustomError>>
    ): ParseResult<State, CustomFlagError, CustomError> | undefined => {
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
                      tag: "UnexpectedFlagValue",
                      dash,
                      name,
                      value: flagValue.value,
                    },
                  };
                case "ViaNextArg":
                case "NextArgMissing":
                case "NotLastInGroup": {
                  const callback = rule[2];
                  const result = handleFlagCallbackResult(
                    dash,
                    name,
                    callback(state, undefined)
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
                  const result = handleFlagCallbackResult(
                    dash,
                    name,
                    callback(state, flagValue.value)
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
                      tag: "MissingFlagValue",
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
      const result = handleCallbackResult(options.onArg(state, arg));
      if (result !== undefined) {
        return result;
      }
    }
  }

  return { tag: "Ok", state };
}
