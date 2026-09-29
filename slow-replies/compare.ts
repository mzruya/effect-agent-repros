// Runs every setup through vitest and prints the markdown table. Usage: npm run compare (MESSAGES=400 npm run compare)
import { execFileSync } from "node:child_process";

const columns = {
  "in-memory": "`AgentRuntime.run`, in-memory history",
  "sqlite": "`AgentRuntime.run`, SQLite history",
  "node durable": "Node durable host",
  "cloudflare": "Cloudflare durable host",
};

let output: string;
try {
  output = execFileSync("npx", ["vitest", "run", "--reporter=verbose"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
} catch (error) {
  // A failing setup fails vitest; its output still has every reply that settled, and the failure.
  output = String((error as { stdout?: string }).stdout ?? "") + String((error as { stderr?: string }).stderr ?? "");
}

const times = new Map<string, Map<number, number>>(Object.keys(columns).map((setup) => [setup, new Map()]));
for (const [, setup, message, ms] of output.matchAll(/(in-memory|sqlite|node durable|cloudflare) reply (\d+): (\d+) ms/g)) {
  times.get(setup!)!.set(Number(message), Number(ms));
}
const replies = [...new Set([...times.values()].flatMap((replies) => [...replies.keys()]))].sort((a, b) => a - b);

console.log(`| Reply | ${Object.values(columns).join(" | ")} |`);
console.log(`|---:|${Object.keys(columns).map(() => "---:").join("|")}|`);
for (const message of replies) {
  console.log(`| ${message} | ${Object.keys(columns).map((setup) => times.get(setup)!.has(message) ? `${times.get(setup)!.get(message)} ms` : "–").join(" | ")} |`);
}

const failures = [...output.matchAll(/(?:FAIL|×)\s+.*?(in-memory history|sqlite history|node durable host|cloudflare durable host)[^\n]*\n(?:[^\n]*\n){0,3}?[^\n]*?((?:Error|ThreadLimitExceeded)[^\n]*)/g)];
for (const [, test, reason] of failures) console.log(`\n${test}: ${reason!.trim()}`);
