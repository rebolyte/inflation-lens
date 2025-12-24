import { execSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { parseArgs } from "node:util";
import { sync as globSync } from "glob";

const PATTERN = "./src/**/*.test.ts";

const { values, positionals, tokens } = parseArgs({
  options: {
    debug: { type: "boolean", default: false, short: "d" },
  },
  strict: false,
  allowPositionals: true,
  tokens: true,
});

const passthroughArgs = tokens
  .filter(
    (
      t
    ): t is typeof t & {
      kind: "option";
      rawName: string;
      name: string;
      value?: string;
    } => t.kind === "option" && t.name !== "debug"
  )
  .map(
    (t) =>
      (t.rawName.length === 2 ? t.rawName : `--${t.name}`) +
      (t.value !== undefined ? `=${t.value}` : "")
  );

let matches: string[] = [];
if (positionals.length > 0) {
  for (const pattern of positionals) {
    const dirPath = `./src/${pattern}`;
    if (existsSync(dirPath) && statSync(dirPath).isDirectory()) {
      matches.push(...globSync(`${dirPath}/**/*.test.ts`));
    } else {
      matches.push(...globSync(`./src/**/*${pattern}*.test.ts`));
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
