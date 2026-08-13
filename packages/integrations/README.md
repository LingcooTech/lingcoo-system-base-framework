# @lingcootech/frame-integrations

Provider-neutral external connection lifecycle for Lingcoo Frame. The package owns connection metadata,
encrypted credentials, connection tests, operation events, REST routes and migrations. It intentionally
does not depend on SMTP, storage, payment or AI vendor SDKs; applications register those adapters explicitly.
