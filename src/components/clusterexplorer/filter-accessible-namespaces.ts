import { Kubectl } from "../../kubectl";
import { ExecResult } from "../../binutilplusplus";

/**
 * Filters a list of namespaces to only those the user has access to.
 * A namespace is considered accessible if the user can list any of these resources.
 */

export async function filterAccessibleNamespaces(
    kubectl: Kubectl,
    namespaces: string[]
): Promise<string[]> {
    // Resources to check - assume access to any of these means the namespace is accessible
    const resourcesToCheck = ["pods", "deployments", "services"];

    const accessChecks = namespaces.map(async (ns) => {
        const checks = resourcesToCheck.map(async (resource) => {
            const result = await kubectl.invokeCommand(
                `auth can-i list ${resource} --namespace=${ns}`
            );
            return (
                ExecResult.succeeded(result) && result.stdout.trim() === "yes"
            );
        });

        const results = await Promise.all(checks);
        const hasAnyAccess = results.some((hasAccess) => hasAccess);

        return {
            namespace: ns,
            accessible: hasAnyAccess,
        };
    });

    const results = await Promise.all(accessChecks);
    return results.filter((r) => r.accessible).map((r) => r.namespace);
}
