# AKS onboarding and manual testing

## How saving works

The extension resolves the kubeconfig in this order:

```text
Effective vs-kubernetes.kubeconfig setting
  -> KUBECONFIG in the VS Code extension host's environment
  -> HOME/.kube/config or USERPROFILE/.kube/config
```

For a multi-file `KUBECONFIG`, importing writes to the first nonempty path. It does
not combine all files into a new temporary kubeconfig. The import merges the cluster,
user and context, offers Overwrite / Keep Both / Cancel on duplicate names, and backs
up an existing destination as `<filename>.vscode-k8s-tools-backup` before saving.
Only the previous version of that backup is retained.

The destination dialog shows the selected path and its source before writing. You
can keep it, choose another file or cancel. Choosing another file does not change
your active kubeconfig unless you explicitly accept **Set as Active Kubeconfig**
after a successful save. The destination contents are pinned before its confirmation
dialog. If selection or destination contents change during confirmation, login
preparation or duplicate selection, the import stops rather than overwriting that change.

The extension does not use `/tmp` as its default kubeconfig location. A temporary
destination may come from an existing setting, an environment variable or an explicit
file choice. Environment values in an already running VS Code process may differ
from those in a newly opened terminal.

## Why sign-in can fail despite a successful Azure sign-in

Azure management sign-in lets the extension list clusters and download configuration.
Kubernetes then requests its own access token using the kubeconfig's authentication
instructions. These are separate authentication steps.

The built-in SDK importer previously preserved a returned device-code configuration
without asking which method to use. This path has existed since April 2025; it was
not introduced by the recent command-argument hardening. The behavior can work in a
tenant that permits device code, or stay unnoticed when another kubeconfig already
uses a working CLI login. A specific tester's earlier settings or policy history
cannot be inferred from that fact.

The importer now offers:

- **Azure CLI:** requires Azure CLI and an existing `az login` session for the
  cluster's tenant. The VS Code Microsoft sign-in is not that CLI session.
- **Web Browser:** prepares interactive kubelogin authentication. Access is still
  subject to tenant policy and the browser/runtime environment.
- **Device Code:** keeps the original method only when explicitly selected. Do not
  choose it when the tenant blocks device-code authentication.

For Azure CLI or browser login, the extension uses a trusted `kubelogin` executable
on `PATH` to convert an owned temporary copy of the imported context. It does not
convert the user's existing kubeconfig in place, install tools silently, or perform
an additional token request during preparation. Existing non-device-code
authentication and unrelated entries remain unchanged unless you explicitly
overwrite a duplicate entry.

Native Windows with WSL-based tools retains its existing merge restriction. Open
VS Code through Remote - WSL to import into that environment. External Cloud Explorer
providers and the legacy Azure CLI setup route may have different onboarding steps.

## Test without changing your normal configuration

These are instructions for a tester to run. The automated test suite does not sign
in to a real tenant. The manual authentication check needs permission to use an
existing AKS cluster and a tenant-approved login method; it does not require cluster
resource changes.

1. In VS Code, create a **Temporary Profile** and install the test VSIX into it.
   Do not enable Settings Sync for this profile.
2. Create a private test directory and a `config` file containing:

   ```yaml
   apiVersion: v1
   kind: Config
   clusters: []
   users: []
   contexts: []
   ```

   On macOS/Linux, restrict the directory and file to your user:

   ```sh
   chmod 700 /absolute/path/to/test-directory
   chmod 600 /absolute/path/to/test-directory/config
   ```

3. In the temporary profile's User Settings JSON, point the extension at that file:

   ```json
   {
     "vs-kubernetes": {
       "vs-kubernetes.kubeconfig": "/absolute/path/to/test-directory/config"
     }
   }
   ```

   On Windows, use an absolute Windows path with escaped backslashes or forward
   slashes. Check that the opened workspace does not override this setting.
4. Run **Kubernetes: Add Existing Cluster**, choose AKS, the subscription and the
   existing cluster. For a returned device-code configuration, choose **Azure CLI**
   or **Web Browser** according to tenant policy. Azure CLI users should first log
   in to the correct tenant themselves.
5. Confirm that the destination dialog shows the test file and **VS Code kubeconfig
   setting**. Click **Merge**. The success message must name the same test file.
6. Use **Set as Current Cluster** for the imported context if needed, then **Show
   Cluster Info**. Complete the selected authentication flow. A policy-approved
   login should work without manually rewriting the saved kubeconfig.

### Additional checks

- **Cancel:** retry the import and cancel either login selection or destination
  confirmation. The test file and backup must remain unchanged.
- **Duplicate entry:** import the same cluster again. Check the existing Overwrite,
  Keep Both and Cancel behavior. No unrelated context should disappear.
- **Another file:** choose a second test file in the destination dialog. It must be
  saved there without silently switching the active file. Only accept **Set as
  Active Kubeconfig** if you intend that change.
- **Destination change:** while the confirmation/duplicate dialog is open, change
  the active kubeconfig setting or edit the destination file. The import must stop
  and ask you to add the cluster again rather than overwrite that change.
- **Missing tool/conversion failure:** choose a method without its prerequisites.
  Expect a useful error and no destination write, not a fallback to device code.

To inspect authentication instructions locally, without contacting the cluster:

```sh
kubectl --kubeconfig "/absolute/path/to/test-directory/config" \
  --context "<imported-context>" config view --minify \
  -o jsonpath='{.users[0].user.exec.args}'
```

Do not post a complete kubeconfig, `config view --raw` output, tokens or certificates
when reporting a problem. Share the test VSIX version, onboarding command, redacted
error code and destination/source shown in the dialog. After testing, close the
temporary profile. Do not remove your normal kubeconfig or reset a keychain.
