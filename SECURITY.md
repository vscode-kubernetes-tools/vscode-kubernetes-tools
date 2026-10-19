## Reporting Security Issues

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via our [private vulnerability report form](https://github.com/vscode-kubernetes-tools/vscode-kubernetes-tools/security/advisories/new).

Please include the requested information listed below (as much as you can provide) to help us better understand the nature and scope of the possible issue:

  * Type of issue (e.g. buffer overflow, SQL injection, cross-site scripting, etc.)
  * Full paths of source file(s) related to the manifestation of the issue
  * The location of the affected source code (tag/branch/commit or direct URL)
  * Any special configuration required to reproduce the issue
  * Step-by-step instructions to reproduce the issue
  * Proof-of-concept or exploit code (if possible)
  * Impact of the issue, including how an attacker might exploit the issue

This information will help us triage your report more quickly.

## Preferred Languages

We prefer all communications to be in English.

## External Command Trust Model

A selected kubeconfig and its Kubernetes API endpoint are not automatically trusted to return shell-safe data. Resource metadata, namespaces, container names, contexts, cluster names, selectors, annotations, and tool output must remain data even when a conforming Kubernetes API server would normally validate them.

Extension code that starts an external tool must:

* Use `src/process.ts` with an executable and an argument array.
* Keep executable arguments separate until process creation.
* Leave `shell` disabled.
* Treat display strings as logging only and never reuse them for execution.
* Start integrated terminals with `shellPath` and `shellArgs`; do not use `Terminal.sendText` for executable commands.
* Use `wsl.exe --exec` with individual arguments for WSL commands.
* Validate API-returned identifiers at the response boundary as defence in depth.

The released kubectl and Helm v1 extension APIs accept one command-line string for compatibility. Their adapters parse portable quoted arguments, reject shell operators and control characters, and invoke the executable without a shell. New internal APIs must not accept combined command strings.

Kubernetes admission validation is not a client-side security boundary. A kubeconfig can target a compromised, proxied, emulated, or non-conformant endpoint.

The earlier workspace-settings vulnerability had a different trust boundary: workspace configuration selected an executable. Tool-path settings remain machine-scoped, but that does not mitigate cluster-response values becoming command arguments.
