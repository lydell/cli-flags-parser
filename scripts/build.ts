import * as childProcess from "child_process";
import * as fs from "fs";
import * as path from "path";

const DIR = path.dirname(__dirname);
const BUILD = path.join(DIR, "build");

const READ_MORE =
  "**[➡️ Full readme](https://github.com/lydell/cli-flags-parser)**";

type FileToCopy = {
  src: string;
  dest?: string;
  transformSrc?: (content: string) => string;
  transformDest?: (content: string) => string;
};

const FILES_TO_COPY: Array<FileToCopy> = [
  { src: "LICENSE" },
  { src: "package-real.json", dest: "package.json" },
  {
    src: "README.md",
    transformDest: (content) => content.replace(/## Contents[^]*$/, READ_MORE),
  },
];

if (fs.existsSync(BUILD)) {
  fs.rmdirSync(BUILD, { recursive: true });
}

fs.mkdirSync(BUILD);

for (const { src, dest = src, transformSrc, transformDest } of FILES_TO_COPY) {
  if (transformSrc !== undefined) {
    fs.writeFileSync(
      path.join(DIR, src),
      transformSrc(fs.readFileSync(path.join(DIR, src), "utf8"))
    );
  }
  if (transformDest !== undefined) {
    fs.writeFileSync(
      path.join(BUILD, dest),
      transformDest(fs.readFileSync(path.join(DIR, src), "utf8"))
    );
  } else {
    fs.copyFileSync(path.join(DIR, src), path.join(BUILD, dest));
  }
}

childProcess.spawnSync("npx", ["tsc"], { shell: true, stdio: "inherit" });

function modifyFile(
  file: string,
  transform: (content: string) => string
): void {
  fs.writeFileSync(file, transform(fs.readFileSync(file, "utf8")));
}

function adjustDefaultExport(content: string): string {
  return content.replace(/^exports.default =/m, "module.exports =");
}

modifyFile(path.join(BUILD, "index.js"), adjustDefaultExport);
