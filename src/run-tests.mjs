import { spawnSync } from "node:child_process";

const forwardedArgs = process.argv.slice(2).filter((arg) => arg !== "--run");

const completed = spawnSync(process.execPath, ["--test", ...forwardedArgs], {
  stdio: "inherit",
});

if (completed.error) {
  throw completed.error;
}

process.exit(completed.status ?? 1);
