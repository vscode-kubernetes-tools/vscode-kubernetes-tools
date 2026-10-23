# Invoking `kubectl`

The Kubernetes extension uses the `kubectl` command line tool, and if you're building
on top of it then we expect that you'll need to invoke `kubectl` quite a lot too!
To provide a consistent user experience, the Kubernetes extension
provides an API through which you can run `kubectl` using the same code paths as
the extension.  This means your tool participates in:

* Picking up the `kubectl` binary location, or a custom kubeconfig, from extension config
* Built-in option to install dependencies (if not using auto versioning)
* Automatically matching the `kubectl` version to the server version (if enabled by user)

To invoke `kubectl` through the extension API:

* Request the Kubernetes extension's Kubectl API
* Call `invokeCommand` with an array containing one literal argument per entry

Request `await k8s.extension.kubectl.v2`. Older providers return
`available: false` with `reason: 'version-unknown'`; ask the user to update rather
than falling back to shell-based V1 for dynamic values. V1 remains unchanged.

`invokeCommand` returns a structured result. Check `status` first: `exited` has
`code` and `signal`, `failed` has `reason` and `message`, and `cancelled` records
cancellation. Nonzero exits are normal `exited` results. Both output streams,
including partial output on failure or cancellation, are preserved without trimming.
Each stream is limited to 20 MiB by default; configure `maxBufferBytes` to change it.
Signal termination has code `-1` and a non-null `signal`.

Do not add shell quotes, join the array, or split an existing command string.
Use kubectl's `--` separator before remote commands. Argument separation prevents
shell interpretation, but callers must still validate identifiers and option values.

The following example uses the Kubectl API to implement a 'cordon node' command:

```javascript
import * as k8s from 'vscode-kubernetes-tools-api';

async function cordonNode(nodeId: string) {
    const kubectl = await k8s.extension.kubectl.v2;
    if (!kubectl.available) {
        return;
    }
    const result = await kubectl.api.invokeCommand(['cordon', '--', nodeId]);

    if (result.status !== 'exited' || result.code !== 0) {
        const errorMessage = result.status === 'failed' ? result.message : result.stderr;
        await vscode.window.showErrorMessage(`Cordon failed: ${errorMessage}`);
        return;
    }

    await vscode.window.showInformationMessage(`${nodeId} has been cordoned`);
}
```

## Streaming

For long-running commands, install callbacks through `observeCommand` options.
The callbacks are installed before launch, so initial output cannot be lost while
the caller sets up its completion handler. Chunks are UTF-8 text, not complete lines.

```typescript
const command = kubectl.api.observeCommand(['logs', 'pod-name', '--follow'], {
    onStdout: (chunk) => output.append(chunk),
    onStderr: (chunk) => output.append(chunk),
    cancellationToken,
});
const completion = await command.result;
```

Streaming does not retain output or apply the buffered output limit. `result`
contains only completion status. Call `dispose()` or cancel the supplied token
to stop execution. Both execution methods accept `stdin` as data.
Native Windows command-script wrappers are rejected; configure a `kubectl.exe`.

## Port forwarding

When you need to connect to programs running on pods that are not exposed as external
services, you can use the `kubectl port-forward`
command.  However, the `invokeCommand` API, which waits for `kubectl` to exit before
returning, isn't a good fit for this command.  The extension therefore provides a special
API for port forwarding.  This runs `kubectl port-forward` in the background, and returns
a `status: 'ready'` result containing a session you can dispose to stop forwarding.
Startup failure or cancellation returns a completion result instead. Readiness
defaults to a 10-second timeout, configurable through `timeoutMs`. Both IPv4 and
IPv6 loopback readiness messages are supported, including split output chunks.

The following example shows how to access a tool running in the cluster, which exposes its
functionality via port 80 on its pod.

```javascript
// assume we have successfully obtained the Kubectl API
const forwarding = await kubectl.api.portForward('useful-tool-pod-name', 'default', 9001, 80);
if (forwarding.status !== 'ready') {
    // forwarding failed
    await vscode.window.showErrorMessage("Can't access UsefulTool on cluster");
    return;
}

try {
    const usefulToolUrl = 'http://localhost:9001';  // the forwarded port
    await accessUsefulTool(usefulToolUrl);
} finally {
    // tear down port forwarding
    forwarding.session.dispose();
}
```

Await `forwarding.session.result` to observe termination after readiness. UI
registration is removed when the process completes, including unexpected exits.

### Port forwarding status bar indicator

By default, port forwarding occurs behind the scenes, and it is up to your extension
to determine when to end the forwarding, either programmatically or by displaying its
own UI.  If you would like to give the user an indication
that port forwarding is happening, and allow them to end the forwarding (and thus
end the `kubectl` process), you can ask for your port-forwarding session to be shown
in the status bar by passing an options object to `portForward`.  The options object
should look like this:

```javascript
{
    showInUI: {
        location: 'status-bar'
    }
}
```

You can also provide an optional `description`, which is displayed to help the user
understand what the port-forward is used for and to distinguish it from other port
forwarding sessions.  This is recommended as the user may otherwise have to guess
which sessions they still need and which it is safe to terminate.

Additionally, you can provide an `onCancel` property, which is a function to be
called back if the user terminates the port forwarding via the UI.  You can
use this to present UI, clear state associated with the port-forward, etc.

A fully populated options object might look like this:

```javascript
{
    showInUI: {
        location: 'status-bar',
        description: 'Connection to the linkerd dashboard',
        onCancel: () => { linkerd.isDashboardPortFowarded(false); }
    }
}
```
