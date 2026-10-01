# A chat stops replying once its history compacts

`effect-agent@0.1.0-beta.163`, `effect@4.0.0-rc.117`, `vitest@4.1.11`, Node 24

Once a conversation passes `contextTokenLimit`, the next message fails, and so does every message after it.

A chat with no tools on the Node durable host, with the default compactor. It compacts past 6,000 tokens, keeping
the newest 2,000. Each message is two words, and the model answers every call with the same 150-word reply:

```
message 1: completed
…
message 6: completed
message 7: failed (Compaction coverage cannot be mapped to complete canonical records)
message 8: failed (Compaction coverage cannot be mapped to complete canonical records)
message 9: failed (Compaction coverage cannot be mapped to complete canonical records)
message 10: failed (Compaction coverage cannot be mapped to complete canonical records)
```

## Running it

```sh
npm install
npm test
```
