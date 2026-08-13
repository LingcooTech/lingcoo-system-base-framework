# @lingcootech/frame-identity

Optional Identity and Access feature for Lingcoo Frame. The package owns its
Manifest, environment contract, Fastify routes, Cookie/JWT provider, services,
RBAC/password semantics, PostgreSQL repository and migration source.

Mail delivery, avatars, audit storage and domain events enter through
`IdentityPorts`. Their defaults are safe no-op adapters, so Identity can run
without installing another Feature Extension. Applications opt into richer
integrations at the composition root.
