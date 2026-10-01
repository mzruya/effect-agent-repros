# effect-agent repros

Small reproductions of effect-agent issues. Each folder is its own npm project; see its README.

- [`slow-replies`](slow-replies): submissions take longer to settle as Thread history grows on durable hosts.
- [`compaction-coverage`](compaction-coverage): a chat's first compaction fails with "Compaction coverage cannot be mapped to complete canonical records" when the summary cut lands on a reply.
