# External command execution

All extension-owned process execution uses `CommandInvocation` from `src/process.ts`:

```typescript
const invocation: CommandInvocation = {
    executable: kubectlPath,
    args: ['get', kind, resourceName, '--namespace', namespace, '-o', 'json'],
    cwd,
    env,
};
const result = await executeCommand(invocation);
```

Do not join arguments, invoke an OS shell, enable `shell: true`, or send executable text to a VS Code terminal. Logging may use `renderCommandForDisplay`, but rendered text is never an execution input.

## Sink inventory

| Sink | Classification | Remediation |
| --- | --- | --- |
| kubectl one-shot commands | Direct process, argv | `invokeForResult` uses `executeCommand` |
| kubectl streaming/background commands | Direct process, argv | `invokeTracking` and `invokeBackground` use `spawnCommand` |
| kubectl terminal commands | Integrated terminal, direct executable | selected kubectl path plus `shellArgs`; WSL uses `wsl.exe --exec` |
| Helm commands and repository/release operations | Direct process, argv | `helmExec`, `helmExecAsync`, and feedback helpers accept arrays |
| kubectl/Helm v1 API strings | Compatibility parser, then direct process | shell operators and control characters are rejected |
| Port Forward, logs, events, dashboard proxy | Direct process or direct-process terminal | no terminal command text or pipeline |
| Docker, Buildah, Git, Azure CLI, Minikube | Direct process, argv | structured invocations preserve dynamic values as arguments |
| WSL filesystem and kubeconfig operations | Direct WSL process, argv | `wsl.exe --exec` |
| Install helpers | Node filesystem API or direct WSL process | no command strings |

The only shell script retained is the fixed WSL expression used to read `${KUBECONFIG:-$HOME/.kube/config}`. It contains no interpolated values; `sh`, `-c`, and the fixed script are separate arguments to `wsl.exe --exec`.

## Validation

Validation in `src/utils/kubernetes-identifiers.ts` is defence in depth. Use the field-specific rule:

* Namespace and container names: DNS-1123 label.
* Custom-resource and known DNS-based object names: DNS-1123 subdomain.
* Generic resource names: safe Kubernetes path segment, because built-in kinds do not all share one name grammar. Path-segment names may legitimately begin with `-`; pass them after `--` where the target subcommand supports it.
* Resource types and CRD version components: DNS-1035 label.
* Kubeconfig context, cluster, and user names: non-empty printable data, passed after `--` where kubectl supports it.

Do not substitute a stricter rule merely because it is convenient. Safe argv execution remains the primary control.

## Exceptions

Any new shell-based exception must document why a direct process cannot be used, which syntax is fixed, which values are untrusted, how each value is encoded for every supported shell, and the platform-specific tests protecting it. Unknown terminal shells must fail closed.
