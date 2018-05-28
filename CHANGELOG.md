# Change Log

## 0.1.10

* The Load command now defaults to YAML format instead of JSON.  You can override this using the `vs-kubernetes.outputFormat` configuration setting.
* Added support for specifying an alternate kubeconfig file, using the `vs-kubernetes.kubeconfig` configuration setting.  (If you set this, it overrides the KUBECONFIG environment variable or default kubeconfig path.)
* Manage individual entries within a config map or secret resource
* Fixed an issue where you got spurious save prompts when you loaded a resource from the cluster and then closed it without making any changes.
* Fixed an issue where if you loaded a resource, then loaded it again while the window was still open, the JSON/YAML would get appended to the existing JSON/YAML.
* Clarified that the extension works with any Kubernetes cluster, not just Azure!

Thanks to contributors Brendan Burns and Bhargav Nookala.

## 0.1.9

* Added configmaps and secrets to the tree view.
* If you auto-install Draft you now get 0.14.1.
* Added new regions to create AKS cluster wizard.
* Fixed an issue where you could not edit or save resource manifests loaded via command or tree view. (The downside of the fix: we've brought back an issue where you get spurious save prompts if you just want to look at a resource without modifying or saving it. We're trying to work out a better solution!)
* Fixed some commands complaining unnecessarily if there was no editor open.
* Fixed error if you clicked on a service without a selector in the tree view.
* Improved documentation of building and running from source.

Thanks to contributors Brendan Burns and Andy Xu.

## 0.1.8

* Added support for debugging using Draft.
* Added support for port forwarding.
* If the extension detects that a binary (kubectl, Helm, Draft) it needs is missing, it offers to install it for you.
* We now open Kubernetes resources without creating new files, avoiding a save prompt.
* Added a drill-down in the tree view for pods under a service.
* Added a drill-down in the tree view for pods created by a deployment.
* Fixed reference to Azure Container Service when adding an AKS cluster.
* Fixed Open Dashboard command on AKS.
* Improved error messages when no document open, or open document is not JSON or YAML.
* Removed obsolete reference to helm-template plugin.

Thanks to contributors Brendan Burns, Dong Liu, Evan Louie, Radu Matei, Bhargav Nookala and Andy Xu.

## 0.1.7

* Improvements to Kubernetes YAML intellisense.  These improvements depend on the 'YAML Support by Red Hat' extension; please install version 0.0.10 or above of this extension if you are working with Kubernetes YAML files.
* You can now copy a resource name from the tree view.
* The 'choose resource' prompt now supports ingresses.
* The Java debugger now allows you to leave the debug deployment in the cluster for post-mortem diagnostics.
* We've added documentation for the Java debugger.
* After adding a cluster, the tree view now shows it without the need for a refresh.
* The Delete command no longer attempts to delete the resource described by the active document.
* Progress indicators are shown for more commands.
* Added telemetry for which cluster types users select in `Create Cluster`.
* Fixed spurious cluster creation error messages.
* Fixed poor error messages if `docker push` failed because user not set or not logged in.
* Fixed not respecting certificate file references in kubeconfig.
* Fixed an issue where the `Helm: Inspect Values` command was shown in the palette where it wasn't useful.
* Fixed directory error in `Helm: Preview`.
* Fixed an issue with debugging multi-root workspaces.
* Fixed Basic node sizes being incorrectly shown in `Create Cluster` on Azure.
* Fixed the error if you tried to run `Helm: Create` with no folder open.
* `Configure from Cluster` is renamed to `Add Existing Cluster`.

Thanks to contributors Jinbo Wang, Andy Xu and Abdul Rehman (@arehmandev).

## 0.1.6

* Commands with significant output now run in the integrated terminal
* Added an API for other extensions to participate in `Create Cluster` and `Configure from Cluster` commands
* Added Java debugging support
* Improved clarity of user experience and docs for Sync command
* Fixed Helm hover provider
* Fixed confusing failure in Exec and Terminal commands when the open editor didn't contain a manifest that could be mapped to a set of pods
* Fixed a syntax bug in a Helm snippet
* Fixed missing docs describing whether Azure CLI is required

Thanks to contributors Jinbo Wang and Andy Xu.

## 0.1.5

* Added support for Kubernetes dashboard
* ConfigMaps and Secrets are now show in the tree view
* Fixes to Explain command
* UX fixes for Helm warning it's not updating the preview

Thanks to contributors Jinbo Wang and Bhargav Nookala.

## 0.1.4

* Tree view improvements:
  * Select active namespace
  * Show cluster info
  * Delete cluster from kubeconfig
  * Additional get and delete support
* Improved output display with highlighting and 'in progress' status
* Create Cluster - added option to configure extension from new cluster
* Added telemetry on command popularity (see read-me for how to opt out)
* Fixed incorrect .yaml comments and block comments for Helm .tpl
* Fixed 'No charts found' error when opening non-Helm-related folders

Thanks to contributors Jinbo Wang and Bhargav Nookala.

## 0.1.3

* Tree view improvements:
  * Choose your active cluster from those defined in your `kubeconfig`
  * Structure is now better aligned to Kubernetes dashboard
* Fixed `Draft: Up` display for non-watch mode

## 0.1.0

Combined `vs-kubernetes` and `vscode-helm` into one extension.

## vs-kubernetes change log

### 0.0.1

Initial release of vs-kubernetes

### 0.0.2

Internal revision

### 0.0.3

* Add `kubernetes sync` which synchronizes your git repo with running containers
* Initial release of the extension in the marketplace

### 0.0.4

Add checking for the `kubectl` binary in the `PATH`

### 0.0.5

Add support for 'diff' between files and objects on server
Add support for exec and terminal into pods

### 0.0.6

Add support for interactive node.js debugging (Alpha)
Auto build/push for run and debug

### 0.0.7

Fix a hard-coded value that made debug not work on any machine except mine...

### 0.0.8

Lots of fixes.
Contributors:
   * Ivan Towlson
   * Bhargav Nookala

## vscode-helm change log

## 0.1.0
- Initial release

## 0.1.1
- Bug fixes

## 0.2.0
- Add Draft support
- Improve helm templating

## 0.3.0
- Build Kubernetes manifest hover text from the '.kube/schema' directory instead of hard-coded values. This will support TPRs, and will stay up-to-date automatically
- Support for intellisense on deeply nested values.
