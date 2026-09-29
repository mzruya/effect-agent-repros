import { env } from "cloudflare:workers";
import { CloudflareThreadClient } from "@effect-agent/platform-cloudflare/cloudflare-thread-client";
import { BrowserCrypto } from "@effect/platform-browser";
import { Effect, ManagedRuntime, Schema } from "effect";
import { digestDefinitions } from "effect-agent/digest";
import { ThreadId } from "effect-agent/identifiers";
import { IdempotencyKey, Principal } from "effect-agent/receipt";
import { test } from "vitest";
import { chat, definitions, messages, reported } from "../src/chat.ts";

const total = messages((env as { MESSAGES?: string }).MESSAGES);

const threads = ManagedRuntime.make(CloudflareThreadClient.layerFromBinding({ namespace: env.THREADS }));

// The Cloudflare durable host (ThreadObject), in local workerd.
test("cloudflare durable host", async () => {
  for (let message = 1; message <= total; message++) {
    const started = Date.now();
    await threads.runPromise(Effect.gen(function* () {
      const client = yield* CloudflareThreadClient;
      const receipt = yield* client.submit({ definition: chat }, { text: `message ${message}` }, {
        threadId: Schema.decodeSync(ThreadId)("chat"),
        principal: Schema.decodeSync(Principal)("user"),
        idempotencyKey: Schema.decodeSync(IdempotencyKey)(`message-${message}`),
        definitions: yield* digestDefinitions(definitions).pipe(Effect.provide(BrowserCrypto.layer)),
      });
      yield* client.awaitSettlement(receipt);
    }));
    if (reported(message, total)) console.log(`cloudflare reply ${message}: ${Date.now() - started} ms`);
  }
});
