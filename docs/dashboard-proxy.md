# Dashboard proxy sessions

Kubernetes Dashboard uses a directly spawned kubectl process and waits for its
loopback readiness message before opening the browser. The local port is allocated
by kubectl, avoiding an assumption that port 8001 is free. No shell pipeline or
`proxy.out` file is used.

For the existing AKS dashboard detection path, the extension reads the dashboard
pod in `kube-system`, validates its HTTP probe port, and starts a direct pod
port-forward. Both paths bind only to `127.0.0.1`.

Repeated Dashboard commands reuse an active session. Concurrent commands share
startup. Sessions close on active-context, kubeconfig, or execution-configuration
changes, and extension disposal. Open Dashboard again to start a fresh session.
The same session helper owns the short-lived Swagger proxy, which is disposed
after the schema download.

Readiness handles split stdout chunks. Startup errors, early exits, and a
30-second readiness timeout are reported; cancelled sessions terminate their
direct child with bounded escalation and close inherited streams. Cancellation
during executable discovery is checked when the child is returned; discovery
itself and descendant ownership remain responsibilities of the shared executor.
