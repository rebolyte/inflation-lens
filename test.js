import { execSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { parseArgs } from "node:util";
import { sync as globSync } from "glob";

const PATTERN = "./src/**/*.test.js";

const { values, positionals, tokens } = parseArgs({
  options: {
    debug: { type: "boolean", default: false, short: "d" },
  },
  strict: false,
  allowPositionals: true,
  tokens: true,
});

const passthroughArgs = tokens
  .filter((t) => t.kind === "option" && t.name !== "debug")
  .map(
    (t) =>
      (t.rawName.length === 2 ? t.rawName : `--${t.name}`) +
      (t.value !== undefined ? `=${t.value}` : "")
  );

let matches = [];
if (positionals.length > 0) {
  for (const pattern of positionals) {
    const dirPath = `./src/${pattern}`;
    if (existsSync(dirPath) && statSync(dirPath).isDirectory()) {
      matches.push(...globSync(`${dirPath}/**/*.test.js`));
    } else {
      matches.push(...globSync(`./src/**/*${pattern}*.test.js`));
    }
  }
} else {
  matches = globSync(PATTERN);
}

if (matches.length === 0) {
  throw new Error("No tests match the pattern");
}

let command = `node --no-warnings --test`;

if (passthroughArgs.length > 0) {
  command += ` ${passthroughArgs.join(" ")}`;
}

command += ` ${matches.join(" ")}`;

if (values.debug) {
  // eslint-disable-next-line no-console
  console.log(`RUN: ${command}`);
}

execSync(command, { stdio: "inherit" });
