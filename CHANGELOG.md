# Change Log

## [1.3.12]

* Fix: debug attach not working with go app
* Fix: detect errors in yaml file before actually parse it with node-yaml-parser lib
* Fix: retrieve tool paths outside kubernetes object and update README
* Feat: handle predefined vscode variables in extension setting
* Feat: add setting to suppress helm not found warning
* Fix: handle ANSI color codes in log webview
* Fix/cluster tree label issue
* Migrate from k8s.gcr.io to registry.k8s.io
* Added notReady and completed pod status
* Add inline buttons for describe, logs, and terminal
* Fix logs webview jumps back when scrolling up (#1113)

Contributors: lstocchi, jamesorlakin, carljmosca, shikharcodes, Tatsinnit

## [1.3.11]

* Cache minikube show information responce
* Set debug session name to pod name on attach
* Fix to use asWebviewUri to convert webview scripts path
* Document Fix dependency extension name
* Change licence to Apache 2

Contributors: Tatsinnit, WBrettDavis, lstocchi, orgads, itowlson

## [1.3.10]

* Use XDG Base Directory variables when creating the base installation directory
* Added JustMyCode debug option for .NET and Python
* Fixed broker placeholders in Persistent Volume and Perstistent Volume Claim snippets
* Fixed typo in documentation

Contributors: bbodenmiller, heitorlisboa, hyperupcall, yehiyam

## [1.3.9]

* You can now configure default settings for log viewing, and have the log viewer automatically kick off log retrieval and display with your default settings
* Many other improvements and fixes to log viewer
* Fixed unresponsive UI when loading CRDs
* Fixed intellisense (we had an incorrect snippet that threw _everything_ out, sorry)

Contributors: lstocchi, peterbom, SethFalco

## [1.3.8]

* Added snippet for Horizontal Pod Autoscaler
* Added setting to disable fetching all CRDs
* Tweaked log viewer initial settings plus internal rework
* Better closing of kubectl processes when extension deactivates
* Fixed setting to silence CRD extension recommendations

Contributors: Fcmam5, lstocchi, SethFalco

## [1.3.7]

* Improved .NET process identification
* New setting to suppress the "no kubectl binary" warning
* Fixed possible high CPU use when scanning Node project for charts
* Fixed links in fallback schema file
* Fixed dead links to old site
* Fixed CSS links in site
* Added CNCF footer to site

Contributors: flynnduism, gluxon, itowlson, lstocchi, oradwell, pantosha, piotr-sk

## [1.3.6]

* Removed logging from Helm values refresh

Contributors: flowftw

## [1.3.5]

* Added a command to select pods, which you can use to be prompted when debugging
* Improved port forwarding
* Added Camel Yaml CRD recommendation
* If you have YAML file that looks like a k8s resource, but isn't (e.g. kustomize), you
  can now put a comment at the top to stop us complaining about it
* We now watch for changes in Helm's values.yaml
* We now install Arm64 tool builds on M1 Macs
* Fixed issue with vsdbg path not working
* Updates to the maintainer list and the microsite

Contributors: apupier, flowftw, flynnduism, itowlson, loligans, lstocchi, pantosha, paroga

## [1.3.4]

* We can now suggest other VS Code extensions for you based on your installed CRDs
* You can now configure the path to vsdbg
* Improved fetching of custom CRD schemas from active cluster
* Improved performance of the log viewer
* Fixed when Helm completions pop up
* Fixed an issue with displaying many large secrets
* Fixed a packaging issue
* Fixed `chart.yaml` and `requirements.yaml` being treated as Helm templates
* Updated the snippet builder
* Updated some old Node packages

Contributors: brendandburns, evidolob, flowftw, itowlson, ivolzhevbt, lstocchi, pantosha, remcohaszing

## [1.3.3]

* Fixed dependency installation in remote containers
* Fixed ingress snippet indentation
* Fixed `values.yaml` files getting Helm language binding

Thanks to Ezra Morris, markszente and Rakesh Vanga.

## [1.3.2]

* Fixed a bug in the release build of the new logs screen.

Thanks to Luca Stocchi.

## [1.3.1]

* We now have a unified Logs command and view, replacing the old Follow and Show commands.
  The new view has plenty of new options for a much better integrated experience!
* We also have a new Helm Fetch Values command which replaces Inspect Values and supports
  syntax highlighting and editing of the values
* The debug integration now works with Go
* Updated the ingress snippet to the new API version
* The Describe command now does more comprehensive prompting so you shouldn't need to
  type freeform resource names
* Fixed the dashboard command not working
* Fixed over-permissive permissions on installed binaries. Resolves [CVE-2021-31938](https://msrc.microsoft.com/update-guide/vulnerability/CVE-2021-31938).

Thanks to Dakota Clark, Matt Fisher, Shreyas Karnik and Luca Stocchi.

## [1.3.0]

* New API for local tunnel debugger integration
* Helm release history now shows version of chart and app (in tooltip)
* Clicking Helm release history node now shows that release not latest
* Install Dependencies now fetches the correct binaries for arm and arm64 architectures
* We now ignore tool paths at workspace level. This patches [CVE-2021-28448](https://msrc.microsoft.com/update-guide/vulnerability/CVE-2021-28448)

Thanks to Michelle Soedal.

## [1.2.4]

* We have removed Draft support from the extension, because the underlying Draft tool
  had been archived
* The Configuration API now allows other extensions to detect config/context changes
* Fixed node pods having the wrong names and namespaces (which may also have affected
  other features such as log retrieval)
* Fixed an issue where a couple of API contract files were incorrectly modified
* Fixed Follow Logs not working with nondefault kubeconfig
* Fixed some Helm completion items
* Internal changes to the implementation of the Cluster Explorer API
* Internal changes to the build and publish process

Thanks to Adrian Bolt, Matt Fisher, Luca Stocchi and Yevhen Vydolob.

## [1.2.3]

* We now pack the extension to improve load times.  _This was quite an invasive change -
  please let us know if you run into any funnies._
* Added example of setings JSON for disabling linters
* Fixed a missing contribution credit in 1.2.2
* Fixed typo in debugger documentation

Thanks to Jason Behnke and Willem Odendaal.

## 1.2.2

* It now (finally!) works with Snap
* New snippets for:
  * ingress
  * jobs
  * persistent volumes
  * persistent volume claims
  * stateful sets
* You can now see and change context and namespace from the status bar
* We now show job pods as children of the job node
* We've improved Describe output to make it more usable
* New Collapse All button on Cluster Explorer
* Fixed permissions on auto-installed kubectl
* Fixed linter issue with multi-object file
* Fixed an error handling kubectl output with empty columns
* Fixed an error that could prevent other extensions handling YAML files
* Fixed an error with the terminal shell path
* Fixed the tooltip for the Helm `has` function
* Fixed issue where strings from Helm repo could be passed to shell

Thanks to Jonas Goronczy, Tatsat Mishra, Bhargav Nookala and Luca Stocchi.

## 1.2.1

* Helm releases now have Uninstall and Rollback commands
* Follow Logs now has a 'scroll to bottom' button
* We now support Debug (Launch) for Node.js projects
* You can now click on a Helm Repos tree error node to see what the problem was
* Fixed Preview Template command with Helm 3
* Fixed path escaping issue with nested directories when debugging .NET applications
* Fixed issue with attaching to Node.js applications

Thanks to Eli Arbel, Brian Fitzpatrick, Shreyas Karnik, Beda Kuster and Luca Stocchi.

## 1.2.0

* Added Cluster Explorer API v1.1 (watch support, and metadata now always present)
* Fixed filter not being applied to new logs in Follow Logs
* Fixed breakpoints not working when debugging .NET applications
* Fixed Start Minikube command not working because status check failed
* Fixed issue where VS Code was injecting garbage into Set Kubeconfig
* Fixed error and leak when reusing an existing logs panel

Thanks to Matthias Janson and Luca Stocchi.  Luca also joins the project as a core
maintainer!

## 1.1.1

* You can now watch resources in the cluster explorer - get live updates as they change
* Cloud explorer Merge To Kubeconfig command now creates a default kubeconfig if no kubeconfig exists
* Updated .NET debugging support to new C# extension ID
* Fixed AKS dashboard not showing on Kubernetes 1.14 or above

Thanks to hermanho, Mattias Karlsson and Luca Stocchi.

## 1.1.0

* Added .NET debugging support
* Added Configuration API v1
* You can now delete namespaces if you _really really_ want to
* Automatic `kubectl` versioning no longer needs a version of `kubectl` installed to get started
* Updated Helm string functions
* Added Sprig ternary function
* Updated Deployment snippet to `apps/v1`
* Install Dependencies button correctly handles multi-OS installs (specifically for Windows/WSL via VS Code Remote)

Thanks to Patrick Carnahan, Ted Chambers, amirschw and Michelle Soedal.

## 1.0.9

* Added syntax highlighting for Helm 3 `Chart.lock` files
* Fixed bug when displaying a Helm release using Helm 3

Thanks to Remco Haszing.

## 1.0.8

* Fixed bug when doing Inspect Chart on a chart from a Helm repository

## 1.0.7

* Install Dependencies now installs the latest version of Helm
* Fixed autoversion and Install Dependencies not working on VS Code 1.40
* Fixed Helm 'Convert to Template Parameter' command
* Fixed incorrect warnings on `NamespaceSpec.finalizers` and `ResourceQuotaSpec.scopes` YAML
* Added telemetry for the use of local dev clusters such as Kind and Microk8s - see disclosure statement in readme

## 1.0.6

* Fixed too many closing braces in Helm autocomplete
* Fixed YAML validation warning on IntOrString values that were numeric
* Fixed an error if the path to `kubectl` contained spaces.

Thanks to Ahmadali Shafiee.

## 1.0.5

* Updated Deployment template to more recent Kubernetes API
* Further Helm 3 compatibility work
* We now (finally!) download a version of Helm that was not hand carved onto floppy discs by ancient Sumerians
* Fixed Minikube upgrade check
* Fixed spawning an inordinate number of `kubectl proxy` processes
* Fixed polluting the Array prototype which could confuse other extensions

Thanks to Marc Abouchacra and antonyveyre.

## 1.0.4

* Helm 3 compatibility
* Fixed preview of Helm chart `NOTES.txt` being empty
* Fixed 'no schema content' error on CRD instances with no schema

## 1.0.3

* The extension will now validate custom resources against CRD schemas where available
* Added option to send logs to terminal instead of webview
* Fix occasional truncation when displaying config values

## 1.0.2

* The Scale command now appears on the right-click menu of appropriate resources
* Use webview for Follow Logs command
* Added `sha1sum` function to Helm template function list
* We now recognise `.kube/config` as a YAML file
* Fixed error in Minikube Status
* Fixed an autocomplete bug in Helm templates
* Removed an unused dependency that was bulking up the install

Thanks to Brendan Burns, Alex Kreidler, Adam Medzinski and Stefan Prietl.

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
