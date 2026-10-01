import { rmSync } from "node:fs";
import { NodeDurableHost } from "@effect-agent/platform-node";
import { ScriptedModel, ScriptedStreamTurn } from "@effect-agent/testing/scripted-model";
import { Effect, Layer, Schema } from "effect";
import { LanguageModel, Model, Toolkit } from "effect/unstable/ai";
import { Agent, Output } from "effect-agent";
import { CompactionPolicy } from "effect-agent/agent-policy";
import { digestDefinitions } from "effect-agent/digest";
import { ThreadId } from "effect-agent/identifiers";
import { IdempotencyKey, Principal } from "effect-agent/receipt";
import { DefinitionDigestInput } from "effect-agent/records";
import { expect, test } from "vitest";

// A chat that compacts early: past 6,000 tokens it summarizes all but the newest 2,000.
const chat = Agent.make("chat", {
  input: Schema.Struct({ text: Schema.String }),
  output: Output.text(Schema.String),
  instructions: "Reply in detail.",
  toolkit: Toolkit.make(),
  policy: { contextTokenLimit: 6_000, compaction: CompactionPolicy.make({ keepRecentTokens: 2_000 }) },
});

const definitions = DefinitionDigestInput.make({ agent: { id: chat.id, revision: 1 }, model: { provider: "scripted", name: "scripted" }, tools: {} });

// Every model call, the summary's included, answers with the same long reply.
const reply = (text: string) => ScriptedStreamTurn.make({
  parts: [
    { type: "text-start", id: "t" }, { type: "text-delta", id: "t", delta: text }, { type: "text-end", id: "t" },
    { type: "finish", reason: "stop", usage: { inputTokens: { total: 1 }, outputTokens: { total: 1 } } },
  ],
  termination: { _tag: "Complete" },
});

const longReply = reply("lorem ipsum dolor sit amet ".repeat(150));

const model = Model.make("scripted", "scripted", Layer.effect(LanguageModel.LanguageModel, LanguageModel.LanguageModel).pipe(
  Layer.provide(ScriptedModel.layer(Array.from({ length: 100 }, () => longReply)))));

test("a chat keeps replying after its history compacts", async () => {
  rmSync("durable.sqlite", { force: true });

  const host = NodeDurableHost.layer([{ agent: chat, model, definitions }],
    { filename: "durable.sqlite", deploymentId: "repro", producerId: "repro", settlementPollInterval: 1 });

  const send = (message: number) => Effect.gen(function* () {
    const node = yield* NodeDurableHost.NodeDurableHost;

    const receipt = yield* node.submit({ definition: chat }, { text: `message ${message}` }, {
      threadId: Schema.decodeSync(ThreadId)("chat"),
      principal: Schema.decodeSync(Principal)("user"),
      idempotencyKey: Schema.decodeSync(IdempotencyKey)(`message-${message}`),
      definitions: yield* digestDefinitions(definitions),
    });

    const { outcome, failure } = yield* node.awaitSettlement(receipt);

    return `message ${message}: ${outcome}${failure === undefined ? "" : ` (${failure.message})`}`;
  });

  // Short messages, long replies. Once the history passes the limit, every message fails the same way.
  const results = await Effect.runPromise(Effect.forEach([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], send).pipe(Effect.provide(host)));

  console.log(results.join("\n"));
  expect(results.filter((result) => !result.endsWith("completed"))).toEqual([]);
}, 120_000);
