# Swagger proxy sessions

Cluster OpenAPI schema downloads use a directly spawned `kubectl proxy` process.
The proxy binds only to `127.0.0.1`, uses a port allocated by kubectl, and must
report readiness before the schema download begins. Proxy requests are limited
to the `/openapi/v2` path.

The extension owns the proxy process and stops it after the download, on active
context or kubeconfig changes, when execution configuration changes, and during
extension disposal. Readiness detection handles output split across chunks and
has a 30-second timeout. Startup errors and early exits are returned to the
caller, while cancellation terminates the direct child with bounded escalation.
Schema downloads have a 60-second deadline and a 64 MiB response limit.
