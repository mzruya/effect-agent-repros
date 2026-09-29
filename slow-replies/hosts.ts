// The same conversation on four hosts, side by side. Usage: npm run hosts
import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import { NodeDurableHost } from "@effect-agent/platform-node";
import { SqliteThreadStore } from "@effect-agent/storage-sqlite";
import { Effect, Layer, Schema } from "effect";
import { AgentRuntime, InMemory, PersistentHistory } from "effect-agent";
import { digestDefinitions } from "effect-agent/digest";
import { ThreadId } from "effect-agent/identifiers";
import { IdempotencyKey, Principal } from "effect-agent/receipt";
import { chat, definitions, messages, model, reported } from "./src/chat.ts";

const threadId = Schema.decodeSync(ThreadId)("chat");

// 1 and 2: run the agent directly. They differ only in where the conversation is kept.
const runAgent = (message: number) =>
  AgentRuntime.run(chat, { text: `message ${message}` }, { threadId }).pipe(Effect.provide(model));

const inMemory = InMemory.layer;

const sqliteHistory = PersistentHistory.layer.pipe(Layer.provide(SqliteThreadStore.layer({ filename: "history.sqlite" })));

// 3: the durable host. Each message is admitted as a submission, run by a worker, and recorded durably.
const submit = (message: number) => Effect.gen(function* () {
  const host = yield* NodeDurableHost.NodeDurableHost;
  const receipt = yield* host.submit({ definition: chat }, { text: `message ${message}` }, {
    threadId,
    principal: Schema.decodeSync(Principal)("user"),
    idempotencyKey: Schema.decodeSync(IdempotencyKey)(`message-${message}`),
    definitions: yield* digestDefinitions(definitions),
  });
  yield* host.awaitSettlement(receipt);
});

const nodeDurable = NodeDurableHost.layer([{ agent: chat, model, definitions }], {
  filename: "durable.sqlite",
  deploymentId: "repro",
  producerId: "repro-1",
  // awaitSettlement polls; the default 500 ms would hide the work being measured.
  settlementPollInterval: 1,
});

// Sends the messages one after another, and returns ms per reply for the reported replies.
const converse = <E, R>(reply: (message: number) => Effect.Effect<unknown, E, R>) => Effect.gen(function* () {
  const times = new Map<number, number>();
  for (let message = 1; message <= messages; message++) {
    const started = performance.now();
    yield* reply(message);
    if (reported(message)) times.set(message, Math.round(performance.now() - started));
  }
  return times;
});

// 4: the Cloudflare host runs in workerd, so its conversation is test/repro.test.ts, run through vitest.
const cloudflare = () => {
  const output = execFileSync("npx", ["vitest", "run", "--reporter=verbose"], { encoding: "utf8" });
  return new Map([...output.matchAll(/reply (\d+): (\d+) ms/g)].map(([, message, ms]) => [Number(message), Number(ms)]));
};

rmSync("history.sqlite", { force: true });
rmSync("durable.sqlite", { force: true });

console.log("running in-memory, sqlite history, node durable, cloudflare...");
const results = {
  "in-memory": await Effect.runPromise(converse(runAgent).pipe(Effect.provide(inMemory))),
  "sqlite history": await Effect.runPromise(converse(runAgent).pipe(Effect.provide(sqliteHistory))),
  "node durable": await Effect.runPromise(converse(submit).pipe(Effect.provide(nodeDurable))),
  "cloudflare": cloudflare(),
};

console.log(`\nms per reply, one Thread, ${messages} messages, no tools, a model that answers instantly:\n`);
console.log(["reply", ...Object.keys(results)].map((cell) => cell.padStart(15)).join(""));
for (const message of results["in-memory"].keys()) {
  console.log([message, ...Object.values(results).map((times) => times.get(message))].map((cell) => String(cell).padStart(15)).join(""));
}
