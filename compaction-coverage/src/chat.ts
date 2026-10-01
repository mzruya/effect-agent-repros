import { ScriptedModel, ScriptedStreamTurn } from "@effect-agent/testing/scripted-model";
import { Layer, Schema } from "effect";
import { LanguageModel, Model, Toolkit } from "effect/unstable/ai";
import { Agent, Output } from "effect-agent";
import { CompactionPolicy } from "effect-agent/agent-policy";
import { DefinitionDigestInput } from "effect-agent/records";

// A chat with no tools and a small context, so a short conversation compacts: short messages, long replies.
export const chat = Agent.make("chat", {
  input: Schema.Struct({ text: Schema.String }),
  output: Output.text(Schema.String),
  instructions: "Reply in detail.",
  toolkit: Toolkit.make(),
  policy: { contextTokenLimit: 6_000, compaction: CompactionPolicy.make({ keepRecentTokens: 2_000 }) },
});

export const definitions = DefinitionDigestInput.make({
  agent: { id: chat.id, revision: 1 },
  model: { provider: "scripted", name: "scripted" },
  tools: {},
});

const reply = "lorem ipsum dolor sit amet ".repeat(150);

const long = ScriptedStreamTurn.make({
  parts: [
    { type: "text-start", id: "t" }, { type: "text-delta", id: "t", delta: reply }, { type: "text-end", id: "t" },
    { type: "finish", reason: "stop", usage: { inputTokens: { total: 1 }, outputTokens: { total: 1 } } },
  ],
  termination: { _tag: "Complete" },
});

// Every call, the summarizer's included, answers with the same long text.
export const model = Model.make("scripted", "scripted", Layer.effect(LanguageModel.LanguageModel, LanguageModel.LanguageModel).pipe(
  Layer.provide(ScriptedModel.layer(Array.from({ length: 200 }, () => long)))));
