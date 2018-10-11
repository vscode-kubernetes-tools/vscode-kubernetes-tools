# Visual Studio Code Kubernetes Tools
[![Build Status](https://travis-ci.org/Azure/vscode-kubernetes-tools.svg?branch=master)](https://travis-ci.org/Azure/vscode-kubernetes-tools)

An extension for developers building applications to run in Kubernetes clusters,
and for DevOps staff troubleshooting Kubernetes applications.  Features include:

* View your clusters in an explorer tree view, and drill into workloads, services,
  pods and nodes.
* Browse Helm repos and install charts into your Kubernetes cluster.
* Intellisense for Kubernetes resources and Helm charts and templates.
* Edit Kubernetes resource manifests and apply them to your cluster.
* Build and run Dockerfiles in your cluster.
* View diffs of a resource's current state against the resource manifest in your
  Git repo
* Easily check out the Git commit corresponding to a deployed application.
* Run commands or start a shell within your application's pods.
* Get logs and events from your clusters.
* Create Helm charts using scaffolding and snippets.
* Bootstrap applications using Draft, and rapidly deploy and debug them to speed up
  the development loop.

**What's new in this version?**  See the [change log](CHANGELOG.md) to find out!

## Getting started with the extension

### Dependencies

The Kubernetes extension may need to invoke the following command line tools, depending on
which features you use.  You will probably need `kubectl` and `docker` at minimum.

* `kubectl`
* `docker`
* `helm`
* `draft`
* `az` (Azure CLI - only if using the extension to create or register Azure clusters)
* `minikube` (only if you want to use it)
* `git` (only if using the 'sync working copy to repository' feature)

We recommend you install these binaries on your system PATH before using the extension.
If these binaries aren't on your system PATH, then some commands may not work. If the
extension needs one of the core Kubernetes tools and it's missing, it will offer to
install it for you.

### Configuration settings for building and running applications

If you want to use the `Kubernetes: Run` and `Kubernetes: Debug` features
then you need to configure a user and repository for your Docker
images. This is required because these commands need to `docker push` your application
for your cluster to run it. To do this, add the following to your VS Code preferences
(File > Preferences):

```javascript
{
  "vsdocker.imageUser": "<your-image-prefix-here>",
}
```

where `<your-image-prefix-here>` is something like `docker.io/brendanburns`.

**That's it!  You're good to go.**

## Working with kubeconfigs

By default, the extension uses the active kubeconfig file -- that is, the file
to which the KUBECONFIG environment variable points, or the default kubeconfig
if no KUBECONFIG environment variable exists. You can override this using the
`vs-kubernetes.kubeconfig` setting in your user or workspace settings.

If you want to swap between multiple kubeconfig files, you can list them in the
`vs-kubernetes.knownKubeconfigs` configuration setting and switch between them
using the `Set Kubeconfig` command.

## Commands and features

`vs-kubernetes-tools` supports a number of commands for interacting with Kubernetes; these are accessible via the command menu (`Ctrl+Shift+P`) and may be bound to keys in the normal way.

### Kubernetes

#### General commands

   * `Kubernetes: Load` - Load a resource from the Kubernetes API and create a new editor window.
   * `Kubernetes: Get` - Get the status for a specific resource.
   * `Kubernetes: Follow Logs` - Follow logs for a pod in an output window.
   * `Kubernetes: Show Logs` - Show logs for a pod in an output window.
   * `Kubernetes: Follow Events` - Follow events on a selected namespace.
   * `Kubernetes: Show Events` - Show events on a selected namespace.

#### Commands while viewing a Kubernetes manifest file

   * `Kubernetes: Explain` - Use the `kubectl explain ...` tool to annotate Kubernetes API objects
   * `Kubernetes: Create` - Create an object using the current document
   * `Kubernetes: Delete` - Delete an object contained in the current document.
   * `Kubernetes: Apply` - Apply changes to an object contained in the current document.
   * `Kubernetes: Expose` - Expose the object in the current document as a service.
   * `Kubernetes: Describe` - Describe the object in a terminal window.
   * `Kubernetes: Diff` - Show the difference between a local copy of the object, and that which is deployed to the cluster.

#### Commands for application directories

   * `Kubernetes: Run` - Run the current application as a Kubernetes Deployment
   * `Kubernetes: Terminal` - Open an interactive terminal session in a pod of the Kubernetes Deployment
   * `Kubernetes: Exec` - Run a command in a pod of the Kubernetes Deployment
   * `Kubernetes: Debug (Launch)` - Run the current application as a Kubernetes Deployment and attach a debugging session to it (currently works only for Java/Node.js deployments). See [Debug support on Kubernetes cluster](https://github.com/Azure/vscode-kubernetes-tools/blob/master/debug-on-kubernetes.md) for more details.
   * `Kubernetes: Debug (Attach)` - Attach a debugging session to an existing Kubernetes Deployment (currently works only for Java deployments). See [Debug support on Kubernetes cluster](https://github.com/Azure/vscode-kubernetes-tools/blob/master/debug-on-kubernetes.md) for more details.
   * `Kubernetes: Remove Debug` - Remove the deployment and/or service created for a `Kubernetes Debug (Launch)` session
   * `Kubernetes: Sync Working Copy to Cluster` - Checks out the version of the code that matches what is deployed in the cluster.  (This relies on Docker image versions also being Git commit IDs, which the extension does if you use the Run command to build the container, but which typically doesn't work for containers/deployments done by other means.)

#### Cluster creation commands

   * `Kubernetes: Create Cluster` - Initiate the flow for creating a Kubernetes cluster with a selected cloud provider (eg: Azure), or creating a Minikube cluster locally.

#### Configuration commands

   * `Kubernetes: Add Existing Cluster` - Install and configure the Kubernetes command line tool (kubectl) from a cloud cluster, such as an Azure Container Service (ACS) or Azure Kubernetes Service (AKS) cluster
   * `Kubernetes: Set as Current Cluster` - Select from a list of configured clusters to set the "current" cluster. Used for searching, displaying, and deploying Kubernetes resources.
   * `Kubernetes: Delete Context` - Remove a cluster's configuration from the kubeconfig file.
   * `Kubernetes: Set Kubeconfig` - Select from a list of known kubeconfig files (for users who keep different kubeconfig files for different environments).
   * `Kubernetes: Show Cluster Info` - For a cluster, show the status of Kubernetes Components (API Server, etcd, KubeDNS, etc.) in a terminal window.
   * `Kubernetes: Use Namespace` - Select from a list of namespaces to set the "current" namespace. Used for searching, displaying, and deploying Kubernetes resources.

#### ConfigMap and Secret commands

   * `Kubernetes: Add File` - Adds a file as a ConfigMap or a Secret
   * `Kubernetes: Delete File` - Deletes a file from a ConfigMap or a Secret

#### Miscellaneous commands

   * `Kubernetes: Open Dashboard` - Opens the Kubernetes Dashboard in your browser.
   * `Kubernetes: Port Forward` - Prompts user for a local port and a remote port to bind to on a Pod.

### Minikube

[Minikube](https://github.com/kubernetes/minikube) runs a local, single node Kubernetes cluster inside a VM. Support is currently experimental, and requires
Minikube tools to be installed and available on your PATH.

   * `Kubernetes: Start minikube` - Starts Minikube
   * `Kubernetes: Stop minikube` - Stops Minikube

### Helm

[Helm](https://helm.sh/) is the package manager for Kubernetes and provides a way for you to define, install and upgrade applications using 'charts.'  This extension provides a set of tools for creating and testing Helm charts:

   * Syntax highlighting for YAML + Helm Templates
   * Autocomplete for Helm, Sprig, and Go Tpl functions
   * Help text (on hover) for Helm, Sprig, and Go Tpl functions
   * Snippets for quickly scaffolding new charts and templates
   * Commands for...
     * `Helm: Create Chart` - Create a new chart
     * `Helm: Get Release` - Get a helm release from the cluster
     * `Helm: Lint` - Lint your chart
     * `Helm: Preview Template` - Open a preview window and preview how your template will render
     * `Helm: Template` - Run your chart through the template engine
     * `Helm: Dry Run` - Run a helm install --dry-run --debug on a remote cluster and get the results (NOTE: requires Tiller on the remote cluster)
     * `Helm: Version` - Get the Helm version
     * `Helm: Insert Dependency` - Insert a dependency YAML fragment
     * `Helm: Dependency Update` - Update a chart's dependencies
     * `Helm: Package` - Package a chart directory into a chart archive
     * `Helm: Convert to Template` - Create a template based on an existing resource or manifest
     * `Helm: Convert to Template Parameter` - Convert a fixed value in a template to a parameter in the `values.yaml` file
   * Code lenses for:
     * requirements.yaml (Add and update dependencies)
   * Right-click on a chart .tgz file, and choose inspect chart to preview all configurable chart values.

### Draft

[Draft](http://blog.kubernetes.io/2017/05/draft-kubernetes-container-development.html) is a tool to simplify the process of developing a new Kubernetes application, by creating the necessary deployment components and by keeping code in the cluster in sync with the code on your computer.

  * `Draft: Create` - Set up Draft in the current folder (prerequisite for `Draft: Up`)
  * `Draft: Up` - Runs Draft to package the current folder and push it to your cluster. To allow for cluster changes,
  * `Draft: Version` - Get the version of the local Draft client

**NOTE:** Draft itself is in 'draft' form and is not yet stable. So the extension support for Draft is strictly experimental - assumptions may break, and commands and behavior may change!

## Extension Settings

   * `vs-kubernetes` - Parent for Kubernetes-related extension settings
       * `vs-kubernetes.namespace` - The namespace to use for all commands
       * `vs-kubernetes.kubectl-path` - File path to the kubectl binary. Note this is the binary file itself, not just the directory containing the file. On Windows, this must contain the `.exe` extension.
       * `vs-kubernetes.helm-path` - File path to the helm binary. Note this is the binary file itself, not just the directory containing the file. On Windows, this must contain the `.exe` extension.
       * `vs-kubernetes.draft-path` - File path to the draft binary. Note this is the binary file itself, not just the directory containing the file. On Windows, this must contain the `.exe` extension.
       * `vs-kubernetes.minikube-path` - File path to the minikube binary. Note this is the binary file itself, not just the directory containing the file. On Windows, this must contain the `.exe` extension.
       * `vs-kubernetes.kubeconfig` - File path to the kubeconfig file you want to use. This overrides both the default kubeconfig and the KUBECONFIG environment variable.
       * `vs-kubernetes.knownKubeconfigs` - An array of file paths of kubeconfig files that you want to be able to quickly switch between using the Set Kubeconfig command.
       * `vs-kubernetes.autoCleanupOnDebugTerminate` - The flag to control whether to auto cleanup the created deployment and associated pod by the command "Kubernetes: Debug (Launch)". The cleanup action occurs when it failed to start debug session or debug session terminated. If not specified, the extension will prompt for whether to clean up or not. You might choose not to clean up if you wanted to view pod logs, etc.
       * `vs-kubernetes.outputFormat` - The output format that you prefer to view Kubernetes manifests in. One of "yaml" or "json". Defaults to "yaml".
   * `vsdocker.imageUser` - Image prefix for docker images e.g. 'docker.io/brendanburns'

## Custom tool locations

For `kubectl`, `helm` and `draft` the binaries do not need to be on the system PATH. You can configure the extension by specifying the locations using the appropriate `vs-kubernetes -> vs-kubernetes.${tool}-path` configuration setting.  See [Extension Settings](#extension-settings) below.

The extension can install `kubectl`, `helm` and `draft` for you if they are missing - choose **Install dependencies** when you see an error notification for the missing tool.  This will set `kubectl-path`, `helm-path` and `draft-path` entries in your configuration - the programs will *not* be installed on the system PATH, but this will be sufficient for them to work with the extension.

If you are working with Azure Container Services or Azure Kubernetes Services, then you can install and configure `kubectl` using the `Kubernetes: Add Existing Cluster` command.

### Portable extension configuration

If you move your configuration file between machines with different OSes (and therefore different paths to binaries) you can override the following settings on a per-OS basis by appending `.windows`, `.mac` or `.linux` to the setting name:

  * `vs-kubernetes.kubectl-path`
  * `vs-kubernetes.helm-path`
  * `vs-kubernetes.draft-path`
  * `vs-kubernetes.minikube-path`

For example, consider the following settings file:

```json
{
  "vs-kubernetes": {
    "vs-kubernetes.kubectl-path": "/home/foo/kubernetes/bin/kubectl",
    "vs-kubernetes.kubectl-path.windows": "c:\\Users\\foo\\kubernetes\\bin\\kubectl.exe"
  }
}
```

The first path would be used when invoking `kubectl` on Mac or Linux machines.  The second would be used when invoking `kubectl` on Windows machines.

## Keybinding support

The following commands support arguments in keybindings:

  * **Set Kubeconfig** (command ID `extension.vsKubernetesUseKubeconfig`) - the keybinding can specify a string argument which is the kubeconfig file path to switch to.  This allows you to set up specific keybindings for your favourite kubeconfigs.

## Known issues

  * `Kubernetes: Debug` command currently works only with Node.js and Java applications
  * For deeply nested Helm charts, template previews are generated against highest (umbrella) chart values (though for `Helm: Template` calls you can pick your chart)

## Release notes

See the [change log](CHANGELOG.md).

## Telemetry

This extension collects telemetry data to help us build a better experience for building applications with Kubernetes and VS Code. We only collect the following data:

* Which commands are executed
* For the `Create Cluster` and `Configure from Cluster` commands, the cluster type selected.

We do not collect any information about image names, paths, etc. The extension respects the `telemetry.enableTelemetry` setting which you can learn more about in our [FAQ](https://code.visualstudio.com/docs/supporting/faq#_how-to-disable-telemetry-reporting).

## Running from source

If you are building and running the extension from source, see [CONTRIBUTING.md](CONTRIBUTING.md) for prerequisites for the development environment.

## Contributing

This project welcomes contributions and suggestions.  Most contributions require you to agree to a
Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us
the rights to use your contribution. For details, visit https://cla.microsoft.com.

When you submit a pull request, a CLA-bot will automatically determine whether you need to provide
a CLA and decorate the PR appropriately (e.g., label, comment). Simply follow the instructions
provided by the bot. You will only need to do this once across all repos using our CLA.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or
contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

For technical information about contributing, see [CONTRIBUTING.md](CONTRIBUTING.md).

# Acknowledgments

This extension was born from the `vs-kubernetes` extension by @brendandburns and
the `vs-helm` extension by @technosophos.
