# Replies get slower as a conversation grows

`effect-agent@0.1.0-beta.144`, `effect@4.0.0-rc.117`

On the durable hosts, a Thread's reply time grows with the length of its conversation, even with no tools and a
model that answers instantly. In memory, it stays flat. A Thread handles one request at a time, so anything sent
to a long conversation also waits for the current reply.

The same agent, model, and conversation on four hosts, 150 messages to one Thread, each sent after the previous
reply (ms per reply):

```
          reply      in-memory sqlite history   node durable     cloudflare
              1             17              8             33            948
             25              2              7             26             97
             50              3              9             36            123
             75              3             13             45            143
            100              4             14             50            168
            125              4             20             72            174
            150              4             21             81            182
```

| Host | Setup |
|---|---|
| in-memory | `AgentRuntime.run` with `InMemory.layer` |
| sqlite history | `AgentRuntime.run` with `PersistentHistory.layer` over `SqliteThreadStore` |
| node durable | `NodeDurableHost` from `@effect-agent/platform-node` |
| cloudflare | `ThreadObject` from `@effect-agent/platform-cloudflare`, in local workerd through `@cloudflare/vitest-plugin` |

The node durable host uses `settlementPollInterval: 1`. With the default of 500 ms, `awaitSettlement` waits out
the poll and hides the work. The first Cloudflare reply includes starting the Durable Object.

```sh
npm install
npm run hosts   # all four hosts, about 1 minute
npm test        # only the Cloudflare host
```
