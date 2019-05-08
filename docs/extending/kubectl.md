# Invoking `kubectl`

The Kubernetes extension uses the `kubectl` command line tool, and if you're building
on top of it then we expect that you'll need to invoke `kubectl` quite a lot too!
Of course, you can always invoke `kubectl` directly using a library such as `shelljs`,
but in order to provide a consistent user experience, the Kubernetes extension
provides an API through which you can run `kubectl` using the same code paths as
the extension.  This means your tool participates in:

* Picking up the `kubectl` binary location, or a custom kubeconfig, from extension config
* Built-in option to install dependencies (if not using auto versioning)
* Automatically matching the `kubectl` version to the server version (if enabled by user)

To invoke `kubectl` through the extension API:

* Request the Kubernetes extension's Kubectl API
* Call the `invokeCommand` method passing the desired `kubectl` command and arguments

`invokeCommand` returns a promise, which resolves to either:

* An object containing the exit code, standard output and standard error of `kubectl`
* `undefined`, if the Kubernetes extension was unable to invoke `kubectl` at all

The following example uses the Kubectl API to implement a 'cordon node' command:

```javascript
import * as k8s from 'vscode-kubernetes-tools-api';

async function cordonNode(nodeId: string) {
    const kubectl = await k8s.extension.kubectl.v1;
    if (!kubectl.available) {
        return;
    }
    const result = await kubectl.api.invokeCommand(`cordon ${nodeId}`);

    if (!result || result.code !== 0) {
        const errorMessage = result ? result.stderr : 'Unable to invoke kubectl';
        await vscode.window.showErrorMessage(`Cordon failed: ${errorMessage}`);
        return;
    }

    await vscode.window.showInformationMessage(`${nodeId} has been cordoned`);
}
```

## Port forwarding

When you need to connect to programs running on pods that are not exposed as external
services, you can use the `kubectl port-forward`
command.  However, the `invokeCommand` API, which waits for `kubectl` to exit before
returning, isn't a good fit for this command.  The extension therefore provides a special
API for port forwarding.  This runs `kubectl port-forward` in the background, and returns
a `vscode.Disposable` that you can use to terminate port forwarding.

The following example shows how to access a tool running in the cluster, which exposes its
functionality via port 80 on its pod.

```javascript
// assume we have successfully obtained the Kubectl API
const session = await kubectl.portForward('useful-tool-pod-name', 'default', 9001, 80);
if (!session) {
    // forwarding failed
    await vscode.window.showErrorMessage("Can't access UsefulTool on cluster");
    return;
}

try {
    const usefulToolUrl = 'http://localhost:9001';  // the forwarded port
    await accessUsefulTool(usefulToolUrl);
} finally {
    // tear down port forwarding
    session.dispose();
}
```

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
