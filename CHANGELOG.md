# Change Log

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
