# A chat's first compaction fails when the cut lands on a reply

`effect-agent@0.1.0-beta.163`, `effect@4.0.0-rc.117`, `vitest@4.1.11`, Node 24

Once a conversation passes `contextTokenLimit`, the durable runtime fails the run with:

```
CompactionError: Compaction coverage cannot be mapped to complete canonical records
```

The run fails before the model answers, and nothing is recorded, so every later message picks the same cut
and fails too. The Thread can't reply again.

A chat with no tools, the default compactor and default compaction mode, short messages and long replies.
Message 7 is the first to compact, and it fails:

```
× a chat keeps replying after its history first compacts
  → message 7: expected Settlement{ …(7) } to match object { outcome: 'completed' }
```

## Cause

The summarizer and the durable coverage check disagree about where a summary may end.

- **Where the summarizer cuts.** `chooseSummarizeCut` (`src/engine/internal/compaction.ts`) walks back from the
  newest message until it has kept `keepRecentTokens`, then steps back only past `tool` messages. The cut can land
  on an `assistant` reply whose `user` input comes right before it.
- **Where records allow a cut.** In durable records, a Run's first Turn commits the instructions, the input and the
  reply together in one `ModelResponseRecorded`. `projectRunJournalStream` emits one boundary after that whole record,
  so no boundary falls between an input and its reply.
- **Why the check fails.** `commitCompaction` (`src/durable/DurableAgentRuntime.ts`) needs a boundary whose prompt
  length is exactly the cut. Neighbouring boundaries sit one message before and one after, so none matches.

Chats are mostly short inputs and long replies, so the `keepRecentTokens` point usually falls on a reply.

## Fix

Keep a reply with the input that prompted it, as the cut already does for tool results:

```ts
while (cut > 0 && (source[cut]?.role === "tool" ||
  (source[cut]?.role === "assistant" && source[cut - 1]?.role !== "tool") ||
  (source[cut]?.role === "user" && source[cut - 1]?.role === "user"))) cut -= 1;
```

With that line in `chooseSummarizeCut`, the test passes. A sturdier fix would have the durable runtime pass the cut
positions it can map into the `CompactionRequest`.

## Running it

```sh
npm install
npm test
```
