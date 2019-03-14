# Adding Cloud or Cluster Types to the Cluster Wizard

The Kubernetes extension provides the `Add Existing Cluster` command to add a
Kubernetes cluster to your kubeconfig, and the `Create Cluster` command to create a
new Kubernetes cluster to work with.  Out of the box, these commands support
Azure Kubernetes Service clusters and the Minikube local cluster.  You can extend
them with other cluster types (e.g. Amazon EKS) using the Cluster Provider API.

Note that a cluster provider is not needed to _use_ a Kubernetes cluster on any
platform.  As long as the cluster is in kubeconfig, the extension will work with it.
Cluster providers are used only to provide integrated UI for _adding clusters to kubeconfig_
and for _creating new clusters_.

## Elements of a cluster provider

An object that provides a UI for adding a cluster to kubeconfig and/or creating a
new cluster is called a _cluster provider_.  Cluster providers must be hosted within
a Visual Studio Code extension.  This table summarises what your cluster providers and
their hosting extension need to do; the rest of this article goes into detail.

| Component            | Responsibilities                                                     |
|----------------------|----------------------------------------------------------------------|
| Your extension       | Activate in response to relevant commands                            |
|                      | Register cluster providers with Kubernetes extension                 |
| Cluster provider     | Implement the cluster provider interface                             |
|                      | Provide metadata for the cluster type drop-down                      |
|                      | Gather choices from the user via HTML forms                          |
|                      | Invoke platform tools or APIs to create cluster or get config        |
|                      | Display feedback, results, errors, etc. via HTML pages               |
| Kubernetes extension | Display the initial cluster type selector                            |
|                      | Provide a UI host in which the cluster provider can display content  |
|                      | Provide communication channel between HTML and cluster provider code |

## Implementing the cluster provider

A cluster provider must implement the following interface.  (For documentation purposes
the interface is written, in TypeScript terms but any JavaScript object that provides
the specified properties and methods will do.)

```javascript
interface ClusterProvider {
    readonly id: string;
    readonly displayName: string;
    readonly supportedActions: ClusterProviderAction[];
    next(wizard: Wizard, action: ClusterProviderAction, message: any): void;
}
```

### Implementing the metadata

The `id` must be a string that uniquely identifies the cluster provider amongst all other
registered cluster providers.  It is not shown to end users.  Users instead choose your
cluster type using the `displayName`, which the Kubernetes extension shows in the cluster
type drop down at the start of the wizard.  Your provider is only shown for the actions
(commands) listed in its `supportedActions` array: `configure` for `Add Existing Cluster`
and/or `create` for `Create Cluster`.

For example:

```javascript
const MY_PROVIDER = {
    id: "contoso-cloud-kubernetes-service",
    displayName: "Contoso Kubernetes Service",
    supportedActions: ['configure', 'create'],
    next: /* see below */
}
```

The main work of a cluster provider is in the `next` method, which is called by the Kubernetes
extension once the user has chosen your cluster type.  We'll dive into that now.

### Implementing the provider steps

When the user selects your cluster provider, the Kubernetes extension calls your `next`
method.  This is the engine of your provider, called as the first entry point and whenever
the user want to navigate between wizard pages.  The job of `next` is:

* Determine where you are in the process, and what data has been gathered so far
* Perform any actions associated with this stage, e.g. retrieving a list of configuration options
  or initiating provisioning in the cloud.
* Display the next stage of the user interface, whether to gather more information or
  to report a result.

When the Kubernetes extension calls `next`, it passes three values:

* The wizard host that the provider can use to show UI
* The command in progress (from the `supportedActions` list)
* A message object containing any data passed from the previous step of the UI

The first time `next` is called, the message object will be of the form:

```javascript
{
    [${SENDING_STEP_KEY}]: ${SELECT_CLUSTER_TYPE_STEP_ID},
    [${CLUSTER_TYPE_KEY}]: <your_provider_id>
}
```

**NOTE:** The variables `SENDING_STEP_KEY`, `SELECT_CLUSTER_TYPE_STEP_ID` and `CLUSTER_TYPE_KEY`
refer to constants defined in the NPM package.  You should use these constants rather than
embedding their values.

Your implementation should respond to this by calling the wizard argument's `showPage` method
to display the first page of your platform-specific workflow.  Here is an example:

```javascript
import * as k8s from 'vscode-kubernetes-tools-api';
import { ClusterProviderV1 as cp } from 'vscode-kubernetes-tools-api';

function next(wizard: cp.Wizard, action: cp.ClusterProviderAction, message: any): void {
    if (message[cp.SENDING_STEP_KEY] === cp.SELECT_CLUSTER_TYPE_STEP_ID) {
        const html = `<h1>Welcome to the Contoso Kubernetes Service Enterprise Cloud Provisioning Wizard 2019</h1>
        <p>This is the first step of the '${action}' workflow.</p>
        <p>There should be more here but we'll cover that in the next section.</p>
        `;
        wizard.showPage(html);
    } else {
        /* see next section */
    }
}
```

**NOTE:** When you register a cluster provider, you register an object _instance_.  This
instance is used for all commands.  Therefore, your `next` method should not store any
per-command state in the provider object.  The next section discusses how to keep
per-command state across pages.

The `showPage` method accepts a `Thenable<string>` as well as a string.  This is
convenient when you need to perform some async activity (such as calling a management API
in the cloud) while composing your HTML.

## Implementing wizard pages

In addition to providing an environment in which to display your HTML, the wizard host also
provides a way to send data from the page back to the cluster provider.  You _must_ use
this, as the wizard depends on it to route inputs to the right cluster provider and to call
the `next` method.  (Pages that end the wizard - that is, that do not need to be followed by
a call to `next` - do not need to follow this convention.)

* Your page must contain a HTML form.
* The `id` of the form must be the `WIZARD_FORM_NAME` constant defined in the NPM package.
* The form must contain a hidden element whose name is the `CLUSTER_TYPE_KEY` constant
  and whose value is the cluster provider's `id` property.
* The form must contain _all_ information that you want to keep.  You cannot store state
  in the provider between pages - you _must_ pass it from page to page.  (For example,
  if your first page asks for a region ID and your second page for a name, then
  the form on the second page should contain a hidden element that preserves the
  region ID.)
* The form should contain enough information for the `next` method to work out where
  it is in the process.  A hidden element containing a step ID is the easiest way
  to do this.
* The form must _not_ contain a Submit button; instead, when you want to submit the form,
  you must run the JavaScript snippet in the `NEXT_PAGE` constant.

Here is an example.  Notice how the form builds up and how message fields are propagated
via hidden elements.

```javascript
import * as k8s from 'vscode-kubernetes-tools-api';
import { ClusterProviderV1 as cp } from 'vscode-kubernetes-tools-api';

const MY_PROVIDER_ID = "contoso-cloud-kubernetes-service";

const REGION_STEP_ID = "region-step";
const NAME_STEP_ID = "name-step";

function next(wizard: cp.Wizard, action: cp.ClusterProviderAction, message: any): void {
    if (message[cp.SENDING_STEP_KEY] === cp.SELECT_CLUSTER_TYPE_STEP_ID) {
        const html = `<h1>Choose region</h1>
        <form id='${cp.WIZARD_FORM_NAME}'>
            <input type='hidden' name='${cp.SENDING_STEP_KEY}' value='${REGION_STEP_ID}' />
            <input type='hidden' name='${cp.CLUSTER_TYPE_KEY}' value='${MY_PROVIDER_ID}' />
            <p>Region: <input type='text' name='region' /></p>
            <button onclick='${cp.NEXT_PAGE}'>Next &gt;</button>
        </form>
        `;
        wizard.showPage(html);
    } else if message[cp.SENDING_STEP_KEY] === REGION_STEP_ID) {
        if (!message.region) {
            wizard.showPage('<p>Error: region is required</p>');  // classy error handling
            return;
        }
        const html = `<h1>Choose cluster name</h1>
        <form id='${cp.WIZARD_FORM_NAME}'>
            <input type='hidden' name='${cp.SENDING_STEP_KEY}' value='${NAME_STEP_ID}' />
            <input type='hidden' name='${cp.CLUSTER_TYPE_KEY}' value='${MY_PROVIDER_ID}' />
            <input type='hidden' name='region' value='${message.region}' />
            <p>Name: <input type='text' name='name' /></p>
            <button onclick='${cp.NEXT_PAGE}'>Next &gt;</button>
        </form>
        `;
        wizard.showPage(html);
    } else if message[cp.SENDING_STEP_KEY] === NAME_STEP_ID) {
        if (!message.name) {
            wizard.showPage('<p>Error: name is required</p>');  // you can do better than this though
            return;
        }
        contosocloud.createCluster(message.region, message.name);  // ignoring async to keep this short-ish!
        wizard.showPage('<p>Requested cluster creation</p>');
    }
}
```

**TIP:** In practice you'll typically want to break out each step into its own function,
and to have reusable form building logic including propagating fields to preserve data
between steps.

### Wizard pages and async

Often you will need to call an asynchronous API (e.g. cloud API, invoking a tool through the
shell) as part of composing a page.  To support this, the `showPage` method accepts a
`Thenable<string>` such as a promise; the resulting HTML will be shown when the promise resolves.
You can combine this with passing plain strings to display a 'wait' message. Here is an example:

```javascript
import { ClusterProviderV1 as cp } from 'vscode-kubernetes-tools-api';

function next(wizard: cp.Wizard, action: cp.ClusterProviderAction, message: any): void {
    if (message[cp.SENDING_STEP_KEY] === cp.SELECT_CLUSTER_TYPE_STEP_ID) {
        wizard.showPage(`<h1>Fetching regions...</h1>`);
        wizard.showPage(buildRegionPage());
    } else {
        // ...
    }
}

async function buildRegionPage(): Promise<string> {
    const regions = await contosocloud.listRegions();
    const regionOptions = regions.map((r) => `<option value="${r.id}">${r.name}</option>`).join('\n');
    const regionSelector = `<select name='region'>${regionOptions}</select>`;
    const html = `<h1>Choose region</h1>
        <form id='${cp.WIZARD_FORM_NAME}'>
            <input type='hidden' name='${cp.SENDING_STEP_KEY}' value='${REGION_STEP_ID}' />
            <input type='hidden' name='${cp.CLUSTER_TYPE_KEY}' value='${MY_PROVIDER_ID}' />
            <p>Region: ${regionSelector}</p>
            <button onclick='${cp.NEXT_PAGE}'>Next &gt;</button>
        </form>
        `;
    return html;
}
```

For pages that need to update multiple times in response to async operations (for example, a page
that displays the progress of cluster creation), your page builder function can also return an
`Observable<string>`.  **NOTE:** The `Observable` interface included in the Cluster Provider API
is a custom interface, not the well known RxJS interface; please refer to the NPM package docs
for details.

## Registering the cluster provider

In order to be displayed in the `Add Existing Cluster` or `Create Cluster` wizard, a cluster
provider must be _registered_ with the Kubernetes extension.  This is the responsibility
of the VS Code extension that hosts the cluster provider.  To do this, the extension must:

* Activate in response to the `Add Existing Cluster` and/or `Create Cluster` commands
* Request the Kubernetes extension's Cluster Provider API
* Call the `register` method for each cluster provider it wants to display

### Activating the cluster provider extension

Your extension needs to activate in response to the `Add Existing Cluster` and/or `Create Cluster`
commands, so that it can register its cluster provider(s) before the wizard is
displayed.  To do this, your `package.json` must include the following activation events:

```json
    "activationEvents": [
        "onCommand:extension.vsKubernetesConfigureFromCluster",
        "onCommand:extension.vsKubernetesCreateCluster"
    ],
```

Depending on your extension you may have other activation events as well.

### Registering cluster providers with the Kubernetes extension

In your extension's `activate` function, you must register your provider(s) using the
Kubernetes extension API.  The following sample shows how to do this using the NPM
helper package; if you don't use the helper then the process of requesting the API is
more manual but the registration is the same.

```javascript
import * as k8s from 'vscode-kubernetes-tools-api';

export async function activate(context: vscode.ExtensionContext) {
    const cp = await k8s.extension.clusterProvider.v1;

    if (!cp.available) {
        console.log("Unable to register provider: " + cp.reason);
        return;
    }

    cp.api.register(MY_PROVIDER);
}
```

Your cluster provider is now ready for testing!
