export type Dash = "-" | "--";

export type FlagRule<State, FlagError> =
  | [dash: Dash, name: string, callback: VoidCallback<State, FlagError>]
  | [
      dash: Dash,
      name: string,
      valueDescription: string,
      callback: ValueCallback<string, State, FlagError>
    ];

export type FlagErrorWrapper<FlagError> =
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
      valueDescription: string;
    }
  | {
      tag: "ValueFlagNotLastInGroup";
      dash: "-";
      name: string;
      valueDescription: string;
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
      valueDescription: string | undefined;
      error: FlagError;
    };

type FlagValue =
  | { tag: "ViaEquals"; value: string }
  | { tag: "NotLastInGroup" }
  | { tag: "ViaNextArg"; value: string }
  | { tag: "NextArgMissing" };

export type CallbackResult<State, Error> =
  | { tag: "Ok"; state: State; handleRemainingAsRest?: boolean }
  | { tag: "Error"; error: Error };

export type VoidCallback<State, Error> = (
  state: State
) => CallbackResult<State, Error>;

export type ValueCallback<Arg, State, Error> = (
  arg: Arg,
  state: State
) => CallbackResult<State, Error>;

export type Options<State, FlagError, ArgError> = {
  initialState: State;
  flagRulesFromState: (state: State) => Array<FlagRule<State, FlagError>>;
  onArg: ValueCallback<string, State, ArgError>;
  onRest: ValueCallback<Array<string>, State, ArgError>;
};

export type ParseResult<State, FlagError, ArgError> =
  | { tag: "Ok"; state: State }
  | { tag: "FlagError"; error: FlagErrorWrapper<FlagError> }
  | { tag: "ArgError"; error: ArgError };

const optionRegex = /^(--?)([^-=][^=]*)(?:=([^]*))?$/;

export default function parse<State, FlagError = never, ArgError = never>(
  argv: Array<string>,
  options: Options<State, FlagError, ArgError>
): ParseResult<State, FlagError, ArgError> {
  let state = options.initialState;
  let rules = options.flagRulesFromState(state);

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];

    const handleRemainingAsRest = (): ParseResult<
      State,
      FlagError,
      ArgError
    > => {
      const result = options.onRest(argv.slice(index + 1), state);
      switch (result.tag) {
        case "Ok":
          return { tag: "Ok", state: result.state };
        case "Error":
          return { tag: "ArgError", error: result.error };
      }
    };

    const handleFlagCallbackResult = (
      dash: Dash,
      name: string,
      valueDescription: string | undefined,
      result: CallbackResult<State, FlagError>
    ): ParseResult<State, FlagError, ArgError> | undefined => {
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
              valueDescription,
              error: result.error,
            },
          };
      }
    };

    const handleCallbackResult = (
      result: CallbackResult<State, ArgError>
    ): ParseResult<State, FlagError, ArgError> | undefined => {
      switch (result.tag) {
        case "Ok":
          ({ state } = result);
          rules = options.flagRulesFromState(state);
          return result.handleRemainingAsRest === true
            ? handleRemainingAsRest()
            : undefined;
        case "Error":
          return {
            tag: "ArgError",
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

      const items: Array<[name: string, flagValue: FlagValue]> =
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
                  const [, , callback] = rule;
                  const result = handleFlagCallbackResult(
                    dash,
                    name,
                    undefined,
                    callback(state)
                  );
                  if (result !== undefined) {
                    return result;
                  }
                }
              }
            } else {
              const [, , valueDescription, callback] = rule;
              switch (flagValue.tag) {
                // @ts-expect-error: Fallthrough intended.
                case "ViaNextArg":
                  index++;
                case "ViaEquals": {
                  const result = handleFlagCallbackResult(
                    dash,
                    name,
                    valueDescription,
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
                      valueDescription,
                    },
                  };
                case "NextArgMissing":
                  return {
                    tag: "FlagError",
                    error: {
                      tag: "MissingFlagValue",
                      dash,
                      name,
                      valueDescription,
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
