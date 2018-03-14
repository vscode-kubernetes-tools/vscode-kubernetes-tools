# Debug support on Kubernetes cluster

## 1. Supported languages
   * `java` (Required: [Debugger for Java](https://marketplace.visualstudio.com/items?itemName=vscjava.vscode-java-debug) extension)
   * `node`

## 2. Commands for debugging
   * `Kubernetes: Debug (Launch)` - Run the current application as a Kubernetes Deployment and attach a debugging session to it (currently works only for Java/Node.js deployments)
   * `Kubernetes: Debug (Attach)` - Attach a debugging session to an existing Kubernetes Deployment (currently works only for Java deployments)

## 3. How to use it for java debugging
### 3.1 Launch a spring-boot application on Kubernetes and debug it
   * Launch VSCode
   * Open a spring-boot application
   * Containerize first. (if Dockerfile already exists, skip it)
   * Install [Debugger for Java](https://marketplace.visualstudio.com/items?itemName=vscjava.vscode-java-debug) extension (if not)
   * Login in docker client with your Docker Hub or other registries (e.g. Azure ACR) account, and set up the image repository url on the VSCode User Settings (if debugging on minikube, skip it)
```javascript
  {
    ...
    "vsdocker.imageUser": "<your-image-prefix-here>",
    ...
  }
```
Where `<your-image-prefix-here>` is something like `docker.io/brendanburns` or `mycontainerregistry082.azurecr.io`.
   * Trigger VSCode Command `"Kubernetes: Debug (Launch)"`

![launch java debug on minikube](./images/launch-java-debug.gif)

### 3.2 Attach debugger to a running Kubernetes Java Deployment
   * Launch VSCode
   * Open a spring-boot application
   * Install [Debugger for Java](https://marketplace.visualstudio.com/items?itemName=vscjava.vscode-java-debug) extension (if not)
   * Trigger VSCode Command `"Kubernetes: Debug (Attach)"`

![attach java debug](./images/attach-java-debug.gif)
