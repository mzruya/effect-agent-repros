# Submissions take longer to settle as Thread history grows on durable hosts

`effect-agent@0.1.0-beta.144`, `effect@4.0.0-rc.117`, `wrangler@4.143.0`, `@cloudflare/vitest-plugin@1.3.1`, Node 24

These are the latest releases, except Effect: rc.118 removed `effect/unstable/ai`, which effect-agent beta.144
imports.

On the durable hosts, the time for a submission to settle grows with the Thread's history, even with no tools and
a model that answers instantly. Running the agent directly, it stays nearly flat. A Thread handles one request at
a time, so anything sent to a long conversation also waits for the current reply.

The same agent, model, and conversation in four setups: 400 messages to one Thread, each sent after the previous
reply settles.

| Reply | `AgentRuntime.run`, in-memory history | `AgentRuntime.run`, SQLite history | Node durable host | Cloudflare durable host |
|---:|---:|---:|---:|---:|
| 1 | 12 ms | 8 ms | 40 ms | 910 ms |
| 50 | 3 ms | 9 ms | 30 ms | 112 ms |
| 100 | 3 ms | 16 ms | 58 ms | 163 ms |
| 150 | 5 ms | 21 ms | 71 ms | 196 ms |
| 200 | 6 ms | 27 ms | 88 ms | 223 ms |
| 250 | 7 ms | 32 ms | 105 ms | 253 ms |
| 300 | 8 ms | – | 134 ms | 283 ms |
| 350 | – | – | 142 ms | 339 ms |
| 400 | – | – | 187 ms | 439 ms |

| Setup | What runs |
|---|---|
| in-memory history | `AgentRuntime.run` with `InMemory.layer` |
| SQLite history | `AgentRuntime.run` with `PersistentHistory.layer` over `SqliteThreadStore` |
| Node durable host | `NodeDurableHost` from `@effect-agent/platform-node` |
| Cloudflare durable host | `ThreadObject` from `@effect-agent/platform-cloudflare`, in local workerd |

Two setups stop early, for separate reasons:
- **In-memory history** fails at reply 341: `In-memory history exceeds the messages limit of 1024`. Each exchange
  stores three messages (the system instruction, the input, and the reply).
- **SQLite history** hangs on reply 277 without an error. Removing the `Stream.interruptWhen` in effect-agent's
  `enforceDurationDeadline` avoids it, and so does raising Effect's `MaxOpsBeforeYield`.

The Node durable host uses `settlementPollInterval: 1`. With the default of 500 ms, `awaitSettlement` waits out
the poll and hides the work. The first Cloudflare reply includes starting the Durable Object.

## Running it

```sh
npm install
npm test                          # every setup, 150 messages
MESSAGES=400 npm test             # a longer conversation
MESSAGES=400 npm run compare      # the table above
```
