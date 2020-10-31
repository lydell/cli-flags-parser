import parse from "..";

test("empty", () => {
  const args: Array<string> = [];
  const rest: Array<string> = [];

  const result = parse([], {
    initialFlagRules: [],
    onArg: (arg) => {
      args.push(arg);
    },
    onRest: (rest2) => {
      rest.push(...rest2);
    },
  });

  expect(result).toMatchInlineSnapshot(`
    Object {
      "tag": "Ok",
    }
  `);

  expect(args).toMatchInlineSnapshot(`Array []`);

  expect(rest).toMatchInlineSnapshot(`Array []`);
});

test("value flag not last in group", () => {
  const options = {
    a: 0,
    b: 0,
    c: 0,
    abc: 0,
  };
  const result = parse(["--abc=10", "-abc=20"], {
    initialFlagRules: [
      [
        "-",
        "a",
        "switch",
        () => {
          options.a++;
        },
      ],
      [
        "-",
        "b",
        "value",
        (v: string) => {
          options.b += Number(v);
        },
      ],
      [
        "-",
        "c",
        "value",
        (v: string) => {
          options.c += Number(v);
        },
      ],
      [
        "--",
        "abc",
        "value",
        (v: string) => {
          options.abc += Number(v);
        },
      ],
    ],
    onArg: fail,
    onRest: fail,
  });

  expect(result).toMatchInlineSnapshot(`
    Object {
      "error": Object {
        "dash": "-",
        "name": "b",
        "tag": "ValueFlagNotLastInGroup",
      },
      "tag": "FlagError",
    }
  `);

  expect(options).toMatchInlineSnapshot(`
    Object {
      "a": 1,
      "abc": 10,
      "b": 0,
      "c": 0,
    }
  `);
});

test("value flag IS last in group", () => {
  const options = {
    a: 0,
    b: 0,
    c: 0,
    abc: 0,
  };
  const result = parse(["--abc=10", "-abc=100"], {
    initialFlagRules: [
      [
        "-",
        "a",
        "switch",
        () => {
          options.a++;
        },
      ],
      [
        "-",
        "b",
        "switch",
        () => {
          options.b++;
        },
      ],
      [
        "-",
        "c",
        "value",
        (v: string) => {
          options.c += Number(v);
        },
      ],
      [
        "--",
        "abc",
        "value",
        (v: string) => {
          options.abc += Number(v);
        },
      ],
    ],
    onArg: fail,
    onRest: fail,
  });

  expect(result).toMatchInlineSnapshot(`
    Object {
      "tag": "Ok",
    }
  `);

  expect(options).toMatchInlineSnapshot(`
    Object {
      "a": 1,
      "abc": 10,
      "b": 1,
      "c": 100,
    }
  `);
});
