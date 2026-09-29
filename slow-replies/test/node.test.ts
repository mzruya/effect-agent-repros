import { rmSync } from "node:fs";
import { NodeDurableHost } from "@effect-agent/platform-node";
import { SqliteThreadStore } from "@effect-agent/storage-sqlite";
import { Effect, Layer, Schema } from "effect";
import { AgentRuntime, InMemory, PersistentHistory } from "effect-agent";
import { digestDefinitions } from "effect-agent/digest";
import { ThreadId } from "effect-agent/identifiers";
import { IdempotencyKey, Principal } from "effect-agent/receipt";
import { test } from "vitest";
import { chat, definitions, messages, model, reported } from "../src/chat.ts";

const total = messages(process.env.MESSAGES);
const threadId = Schema.decodeSync(ThreadId)("chat");

// Sends the messages one after another and logs the time to settle the reported replies, and the CPU time
// the process spent meanwhile. No timeout wraps a reply: an Effect timer changes scheduling, and hides the
// SQLite history hang. vitest's test timeout reports a hang instead.
const converse = <E, R>(setup: string, reply: (message: number) => Effect.Effect<unknown, E, R>) => Effect.gen(function* () {
  for (let message = 1; message <= total; message++) {
    const started = performance.now();
    const cpu = process.cpuUsage();
    yield* reply(message);
    const { user, system } = process.cpuUsage(cpu);
    if (reported(message, total)) console.log(`${setup} reply ${message}: ${Math.round(performance.now() - started)} ms, cpu ${Math.round((user + system) / 1000)} ms`);
  }
});

// Runs the agent directly; the two setups differ only in where the conversation is kept.
const runAgent = (message: number) =>
  AgentRuntime.run(chat, { text: `message ${message}` }, { threadId }).pipe(Effect.provide(model));

test("in-memory history", () =>
  Effect.runPromise(converse("in-memory", runAgent).pipe(Effect.provide(InMemory.layer))), 120_000);

test("sqlite history", () => {
  rmSync("history.sqlite", { force: true });
  const history = PersistentHistory.layer.pipe(Layer.provide(SqliteThreadStore.layer({ filename: "history.sqlite" })));
  return Effect.runPromise(converse("sqlite", runAgent).pipe(Effect.provide(history)));
}, 120_000);

// The durable host admits each message as a submission, runs it on a worker, and records it durably.
test("node durable host", () => {
  rmSync("durable.sqlite", { force: true });
  const host = NodeDurableHost.layer([{ agent: chat, model, definitions }], {
    filename: "durable.sqlite",
    deploymentId: "repro",
    producerId: "repro-1",
    // awaitSettlement polls; the default 500 ms would hide the work being measured.
    settlementPollInterval: 1,
  });
  const submit = (message: number) => Effect.gen(function* () {
    const node = yield* NodeDurableHost.NodeDurableHost;
    const receipt = yield* node.submit({ definition: chat }, { text: `message ${message}` }, {
      threadId,
      principal: Schema.decodeSync(Principal)("user"),
      idempotencyKey: Schema.decodeSync(IdempotencyKey)(`message-${message}`),
      definitions: yield* digestDefinitions(definitions),
    });
    yield* node.awaitSettlement(receipt);
  });
  return Effect.runPromise(converse("node durable", submit).pipe(Effect.provide(host)));
}, 300_000);
