# Change Log

## 1.0.1

* Added Buildah as an alternative configuration tool - use the `imageBuildTool`
  config setting to prefer it.
* Added basic Python debugging support.  See [the debugging documentation](debug-on-kubernetes.md)
  for how to set this up.
* Added port forwarding for services and deployments
* Added language entries for Helm `requirements.lock` and `.helmignore`
* Fix for node pods not being displayed under more recent versions of kubectl
* Fix to detect latest version of Azure CLI
* Fix for old dependency not playing nicely with other extensions using AWS S3 large file upload
* Fix for `[object Object]` in Cloud Explorer merge to kubeconfig message
* We now have [a homepage](https://azure.github.io/vscode-kubernetes-tools/)!

Thanks to Brendan Burns, Ronan Flynn-Curran, Kim Gustyr, Remco Haszing, Bhargav Nookala and Artem Zatsarynnyi.

## 1.0.0

* We now offer an API for adding your features to the extension!  See the
  [API documentation](docs/extending/) for more information, and use the
  [NPM API library](https://www.npmjs.com/package/vscode-kubernetes-tools-api) to
  easily access it.
* Describe output now appears in a window instead of the console
* Updated AKS region list
* Fix for embedded newlines in chart description
* Fixes to improve VS Code Remote compatibility
* Updated some marketplace metadata

Thanks to Brendan Burns.

Thank you also to everyone who has used the preview versions, contributed
to the code base, or raised issues to suggest features or to let us know about bugs.

## 0.1.18

* Fixed automatic versions of `kubectl` not being executable on Mac or Linux

## 0.1.17

* Added Node.js debug provider
* The extension can now automatically use (and download if necessary) the right version of
  `kubectl` for each cluster you use (currently opt-in via `kubectlVersioning` config setting)
* You can now right-click a YAML file to create, apply or delete the corresponding
  Kubernetes resource. To avoid cluttering the right-click menu for all YAML files,
  this is opt-in via the `resource-commands-on-files` config setting.
* Show Logs now displays logs in a custom view with filtering commands
* Option to suppress the notification to upgrade Minikube
* Improved logic for inferring debug ports from the container spec
* Fixed typo in ReplicationController snippet
* Fixed duplicate Services and Ingress folders in tree
* Fixed bug registering or creating Azure clusters if Azure CLI was 2.0.58 or above
* Telemetry now includes whether `Add Existing Cluster` and `Create Cluster` commands
  succeeded or failed

Thanks to contributors Mitchell Amihod, Brendan Burns, Hanxiao Liu, Vladimir Shaikovskii and yehiyam.

## 0.1.16

* Fixed looping if `kubectl version` returned an error
* Fixed 'Minikube not present' alert on startup
* Fixed error if no disabled linters
* Fixed error if space in path to Minikube binary
* Fixed contributors who were left out of the credits list for 0.1.15

Thanks to contributors Brendan Burns and Aurelien Pupier.

## 0.1.15

* Added custom resources (CRDs), stateful sets and daemon sets to the tree view
* Display pod status and IP address in the tree view
* Display service endpoints in the tree view
* Windows users can now set the extension to use Linux builds of kubectl and Helm via WSL
* Updated the Kubernetes resource schema to 1.12
* You can now disable resource limits linting
* Describe results are now displayed in the main window instead of the terminal
* You can now configure different tool paths on different OSes (for roaming settings)
* Made snippets more consistent
* Added some new snippets
* Explain now works on unsaved files
* Reorganised and rewrote the README
* README now links to the Marketplace (installation) page
* README now covers installing from VSIX for airgapped scenarios
* README now explains how to skip TLS verification of clusters
* Running Helm Update Dependencies from the file explorer or code lens no longer prompts you for which chart to update
* Improved startup speed (after I slowed it down)
* Fixed link to Draft blog post
* Fixed load failure while trying to load schemas for Helm intellisense
* Fixed error on Minikube update availability
* Fixed disabling other extensions' links in the Output window
* Fixed Helm Package command error
* Fixed a type on the Service snippet
* Fixed an issue where the Windows user profile path was being used when kubectl used %HOMEDRIVE%\%HOMEPATH%
* Considerable internal refactoring and error handling

Thanks to contributors Brendan Burns, Dimitris-Ilias Gkanatsios, Mostafa Hussein, Shreyas Karnik, Matthias Lechner, Dan McCracken, Bhargav Nookala, Stefan Schacherl and Ahmadali Shafiee.

## 0.1.14

* Added support for checking Minikube status
* Fixed spurious warning about Red Hat YAML extension version
* Fixed Helm Insert Depenedncy command not working on Windows
* Fixed resource limits warning not displayed in multi-resource YAML and JSON files
* Fixed a typo in Helm messages

Thanks for contributors Brendan Burns, Bernhard Millauer and Andy Xu.

## 0.1.13

* Warn if a pod spec does not specify CPU and/or memory limits
* Added status bar notifications for starting, stopping and running Minikube
* Added storage resources (persistent volumes, persistent volume claims and storage classes) to the tree view
* Added cron jobs to the tree view
* When a cluster resource refers to another resource, you can now use Ctrl+click to follow that reference
* Added new region to create AKS cluster wizard.
* Cluster resource tabs should now reload correctly after restarting VS Code
* Fix for multiple documents in a single YAML file

Thanks to contributors Brendan Burns and Andy Xu.

## 0.1.12

* Added tree view for Helm repos
* Added Helm template authoring commands - convert a resource or manifest to a template, and convert values in a template to parameters in `values.yaml`
* Pods now show status in the tree view
* Added Delete Now to pod context menu
* If you have multiple `kubeconfig` files you can now switch between them within the extension
* Added support for Draft-enabling projects that already have charts
* You can now customize Minikube startup options
* Install Dependencies now installs Minikube if not already present
* We now support the `.yml` extension for Helm templates
* Added Japan East and South East Asia regions to AKS cluster creation wizard
* Better diagnostics if operations fail due to mismatched kubectl/cluster versions
* Fixed issue where on Windows we used USERPROFILE even if HOME was defined
* Fixed issue viewing logs on MacOS due to JSONPath quoting differences
* Fixed issue listing Draft packs
* Removed invalid Get command from Helm release tree view context menu
* Documentation updates and fixes
* The extension should now start a _lot_ faster!

Thanks to contributors Brendan Burns, Mostafa Hossein, Dinica Ion, Shreyas Karnik, Bhargav Nookala and Tomas Restrepo, and to [Bhargav's cat for "helping" with the README](https://twitter.com/bhargav/status/1017900168027312128?s=20).

## 0.1.11

* Moved the Clusters tree view to a new activity bar view.
* You can now expand nodes in the tree view to see the pods running on them.
* Clusters are now displayed using the context name instead of the raw cluster name.
* The tree view now lists Helm releases in the cluster.
* When creating an Azure cluster, we now generate the SSH keys for you if required.
* You can now choose to follow (tail) logs as they are emitted.
* You can now view events (at the namespace level in the tree view).
* Port forward now supports multiple port pairs.
* You can now create or attach to a Minikube cluster from within the extension.
* You can now change namespace from the command palette as well as the tree view.
* Updated the versions of Helm and Draft installed by 'Install Dependencies' button.
* Fixed error handling Helm templates in subdirectories of /templates.
* Fixed issue with port forward if the pods were not in the default namespace.
* Fixed error invoking configmap/secret commands from command palette.
* Fixed spurious 'Chart not found' message.
* Fixed a couple of Helm preview errors.

Thanks to contributors Brendan Burns, Shreyas Karnik, Bhargav Nookala and Kamesh Sampath.

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
