# @lingcootech/frame-notifications

Optional in-app Notifications feature. It owns notification REST routes,
delivery orchestration, Outbox policies, the email delivery job and its
PostgreSQL migration. Identity account lookup, Jobs commands, Audit and Mail
implementations are injected through `NotificationsPorts`; the package does
not read Identity or Jobs tables and does not contain SMTP or credential
encryption implementations.
