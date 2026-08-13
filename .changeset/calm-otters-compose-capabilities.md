---
'@lingcootech/frame-extension-sdk': minor
'@lingcootech/frame-kernel': minor
'@lingcootech/frame-database': minor
'@lingcootech/frame-fastify': minor
'@lingcootech/frame-opentelemetry': minor
'@lingcootech/frame-identity': minor
'@lingcootech/frame-integrations': minor
'@lingcootech/frame-mail-nodemailer': minor
'@lingcootech/frame-storage-qiniu': minor
'@lingcootech/frame-ai-openrouter': minor
'@lingcootech/frame-payments': minor
'@lingcootech/frame-jobs': minor
'@lingcootech/frame-notifications': minor
'@lingcootech/frame': minor
'@lingcootech/frame-admin': minor
'@lingcootech/frame-assets': minor
'@lingcootech/frame-web': minor
---

Add versioned, runtime-surface capability providers and requirements to extension manifests, including composition-time conflict, compatibility, ordering, and cycle validation.

Add an injectable SecurityProvider contract and move the existing Cookie/JWT session implementation behind the default provider without changing existing application behavior.

Bind declared Server capabilities to concrete runtime implementations through a read-only CapabilityRegistry, and resolve Frame's default SecurityProvider through that registry.

Add extension-owned environment contributors with scoped parsing, declaration conflict checks, sensitive-value handling, and a read-only runtime registry. Move default Identity AUTH configuration out of the generic AppEnv contract.

Split the default runtime and frontend composition into explicit Kernel and optional Identity extensions while retaining the historical all-in-one Core extension as a compatibility entry point. Kernel-only systems use a deny-by-default security runtime and applications can install their own capability-providing Identity extension.

Make the default `frameKernelSystem` a genuinely empty extension composition. The Kernel Host now owns health and PostgreSQL readiness routes, API/Worker/Migration runtimes accept zero extensions, empty workers do not connect to legacy Job/Outbox storage, and empty migration plans complete without opening a database connection. Existing platform features and Identity remain available only through explicit compatibility presets.

Materialize the architecture as publishable package boundaries: the infrastructure-neutral `frame-kernel` owns system, capability, extension and migration composition; `frame-fastify` implements the HTTP Host adapter; `frame-database` implements the PostgreSQL/Drizzle database port; and optional `frame-opentelemetry` bridges the Kernel telemetry port to the official OpenTelemetry API. Keep `frame` as a compatibility aggregate while legacy Feature Extensions are extracted.

Start the Feature Extension extraction with `frame-identity`: move its Manifest, scoped environment, RBAC/password contracts, Cookie/JWT SecurityProvider and PostgreSQL Session Repository out of the compatibility aggregate. Promote extension environment composition to Kernel and the SecurityProvider contract to the Fastify Adapter, preserving legacy Frame exports as thin compatibility forwards.

Complete Identity ownership by moving Auth/Access routes, account services and the final-state PostgreSQL migration source into `frame-identity`. Replace direct Mail, Assets, Audit and Outbox coupling with injectable `IdentityPorts`, keep enhanced legacy adapters in the Frame composition layer, and make the Reference System import Identity from its owning package.

Extract PostgreSQL Jobs and transactional Outbox into `frame-jobs`, including REST administration routes, worker registries, audit ports and its own migration source. Remove Identity's hidden Outbox table dependency and make Jobs an explicit application composition choice.

Extract in-app Notifications and mail-delivery orchestration into `frame-notifications`, including REST routes, delivery state, Outbox policies, Worker handlers, Admin ownership and its own migration source. Replace SMTP, Integration, credential-decryption and Audit coupling with injectable Notifications Ports while retaining those implementations in the compatibility Frame adapter.

Extract the provider-neutral connection lifecycle into `frame-integrations`, including Provider contracts and Registry, encrypted credentials, connection tests, operation events, REST routes, Admin ownership and its own migration source. Keep SMTP, storage, payment and AI vendor adapters in the compatibility Frame layer pending their independent adapter packages.

Move SMTP, Qiniu storage, Alipay/WeChat Pay and OpenRouter implementations into independently publishable adapter packages. Keep legacy imports as compatibility forwards; each HTTP-capable adapter now owns its route schemas and registration surface while Integrations Core remains provider-neutral.

Extract media Assets into `frame-assets`, including its Manifest, REST lifecycle, reference protection, Worker handlers, Admin ownership and migration source. Replace direct Integration, Qiniu, Jobs table and Audit coupling with injectable ports, while the Frame compatibility composition supplies the existing implementations.

Reset the development-stage database schema into final-state Feature-owned migration sources. This release requires a fresh database; in-place data-preserving upgrades from 0.7.1 are intentionally outside the supported migration contract. CI and release gates verify fresh migration completeness and idempotency without weakening migration checksum validation.
