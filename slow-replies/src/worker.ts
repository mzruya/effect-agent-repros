import { ThreadObject } from "@effect-agent/platform-cloudflare";
import { CloudflareThreadClient } from "@effect-agent/platform-cloudflare/cloudflare-thread-client";
import { Layer } from "effect";
import { ApprovalDenyAll } from "effect-agent/approval";
import { chat, definitions, model } from "./chat.ts";

export class Thread extends ThreadObject.make(
  ThreadObject.layer([{ agent: chat, model, definitions }]).pipe(Layer.provide(CloudflareThreadClient.layer), Layer.provide(ApprovalDenyAll)),
  { namespaceBinding: "THREADS", deploymentId: "repro", producerPrefix: "worker" },
) {}

export default { fetch: () => new Response(null, { status: 404 }) };
