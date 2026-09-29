import { ScriptedModel, ScriptedStreamTurn } from "@effect-agent/testing/scripted-model";
import { Layer, Schema } from "effect";
import { LanguageModel, Model, Toolkit } from "effect/unstable/ai";
import { Agent, Output } from "effect-agent";
import { DefinitionDigestInput } from "effect-agent/records";

// The same agent and model on every host: a chat with no tools, and a model that always answers "ok" instantly.
export const chat = Agent.make("chat", {
  input: Schema.Struct({ text: Schema.String }),
  output: Output.text(Schema.String),
  instructions: "Reply briefly.",
  toolkit: Toolkit.make(),
});

export const definitions = DefinitionDigestInput.make({
  agent: { id: chat.id, revision: 1 },
  model: { provider: "scripted", name: "scripted" },
  tools: {},
});

const ok = ScriptedStreamTurn.make({
  parts: [
    { type: "text-start", id: "t" }, { type: "text-delta", id: "t", delta: "ok" }, { type: "text-end", id: "t" },
    { type: "finish", reason: "stop", usage: { inputTokens: { total: 1 }, outputTokens: { total: 1 } } },
  ],
  termination: { _tag: "Complete" },
});

export const model = Model.make("scripted", "scripted", Layer.effect(LanguageModel.LanguageModel, LanguageModel.LanguageModel).pipe(
  Layer.provide(ScriptedModel.layer(Array.from({ length: 5_000 }, () => ok)))));

// How many messages the conversation grows to: MESSAGES=400 npm test.
export const messages = (value: string | undefined) => Number(value ?? 150);
export const reported = (message: number, total: number) => message === 1 || message % (total > 200 ? 50 : 25) === 0;
