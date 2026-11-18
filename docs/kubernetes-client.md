# Kubernetes client connection and namespace pilot

The Clusters view uses the existing `@kubernetes/client-node` dependency to list
namespaces for supported native connections. Context discovery, the current
namespace and cluster configuration are read locally without kubectl.

Other resource readers, writes, logs, watches, interactive commands and manifest
operations are not migrated by this change.

## Connection flow

```text
Clusters view
  -> read selected kubeconfig files locally
  -> expand the active context and Namespaces folder
  -> capture connection and active namespace
  -> choose transport before dispatch
       -> supported native connection: official client
       -> compatibility case: shared internal argv executor
```

Configuration loading preserves the existing setting/environment/default path
selection and first-file-wins merge order. Missing, blank and comment-only
sources are skipped. Relative native kubeconfig paths use the workspace working
directory, matching CLI execution. Certificate/key paths remain relative to the
file that supplied them.

Each direct read uses a fresh SDK configuration built from captured file contents.
Switching contexts or selecting another kubeconfig cannot redirect later pages
of an in-flight read. Credential state is not shared between configurations that
happen to use the same username. Reading local context metadata does not execute
credential plugins or contact the cluster.

## Namespace transport support

| Configuration | Namespace read path |
| --- | --- |
| Supported native token, client certificate, basic or anonymous authentication | Official client |
| Exec credential plugins, legacy providers, impersonation, token files or other unsupported fields | Safe CLI, preserving existing authentication behavior |
| Windows-local extension host configured to use WSL | Guest CLI, not a host-side SDK using guest paths |
| Ambient HTTP/HTTPS proxy variables | Safe CLI until direct transport parity is established |
| HTTP endpoint without an explicit TLS-skip setting | Safe CLI because client-node 1.4 rejects this configuration; do not change the user's TLS settings |

Compatibility checks are conservative: unsupported fields in another entry in
the selected kubeconfig also select the CLI. Remote WSL with native Linux
configuration uses the native rules.

CLI reads pin kubeconfig paths and context for executable discovery, automatic
version probes and execution. They use literal argument arrays, bounded output,
authentication-prompt monitoring and cancellation that waits for process cleanup.
Windows-local WSL execution forwards guest kubeconfig paths without converting
or evaluating them. Host-mode changes during preparation cancel the operation.

This change reuses the internal execution foundation for the planned shared
KubectlV2 API. It does not expose V2 or change released V1, CloudExplorer,
ClusterExplorer or Configuration contracts. Public V1 execution is not made safe
by this migration and is never a fallback for the new reader.

## Startup without kubectl

The extension no longer warns about missing kubectl merely because it activated.
Tool-dependent features still require it. When kubectl is unavailable, background
schema loading uses the bundled schema, extension recommendations are skipped,
and telemetry does not probe the cluster through kubectl.

With automatic kubectl version selection, existing CLI-backed background work
may still download/use kubectl. This pilot does not implement the separate
on-demand connection policy or change existing startup notification ordering.

## Read behavior and validation

- Preserve namespace metadata, labels and the active-namespace marker.
- Follow pagination, keep continuation tokens opaque and reject repeated tokens.
- Validate returned names before exposing them to the explorer.
- Bound direct responses to 20 MiB across all pages before JSON deserialization.
- Apply a 30-second direct API deadline and support caller cancellation.
- Distinguish authentication, permission, timeout and cancellation errors without
  including raw response bodies, credentials or malformed kubeconfig text.
- Never retry a failed SDK request through the CLI. Choose the transport first.

Tests cover owned local endpoints and the explorer path from context discovery
to rendered namespaces, plus connection isolation, configuration precedence,
compatibility routing, process cleanup and error handling. These do not replace
live authentication/refresh, certificates/proxies, supported Kubernetes server
versions or native Windows/Linux/WSL validation. Complete those release gates
before claiming cross-platform readiness or expanding the migration.
