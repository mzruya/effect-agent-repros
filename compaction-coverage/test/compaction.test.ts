import { rmSync } from "node:fs";
import { NodeDurableHost } from "@effect-agent/platform-node";
import { Effect, Schema } from "effect";
import { digestDefinitions } from "effect-agent/digest";
import { ThreadId } from "effect-agent/identifiers";
import { IdempotencyKey, Principal } from "effect-agent/receipt";
import { expect, test } from "vitest";
import { chat, definitions, model } from "../src/chat.ts";

const threadId = Schema.decodeSync(ThreadId)("chat");

// Short messages and long replies: once the conversation passes contextTokenLimit, every reply should still settle.
test("a chat keeps replying after its history first compacts", () => {
  rmSync("durable.sqlite", { force: true });
  const host = NodeDurableHost.layer([{ agent: chat, model, definitions }], {
    filename: "durable.sqlite",
    deploymentId: "repro",
    producerId: "repro-1",
    settlementPollInterval: 1,
  });

  const send = (message: number) => Effect.gen(function* () {
    const node = yield* NodeDurableHost.NodeDurableHost;
    const receipt = yield* node.submit({ definition: chat }, { text: `message ${message}` }, {
      threadId,
      principal: Schema.decodeSync(Principal)("user"),
      idempotencyKey: Schema.decodeSync(IdempotencyKey)(`message-${message}`),
      definitions: yield* digestDefinitions(definitions),
    });

    return yield* node.awaitSettlement(receipt);
  });

  return Effect.runPromise(Effect.gen(function* () {
    for (let message = 1; message <= 12; message++) {
      const settlement = yield* send(message);

      expect(settlement, `message ${message}`).toMatchObject({ outcome: "completed" });
    }
  }).pipe(Effect.provide(host)));
}, 120_000);
