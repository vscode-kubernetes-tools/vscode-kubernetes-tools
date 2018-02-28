/**
 * The model for 'x-kubernetes-group-version-kind' node in kubernetes schema, a sample schema would look like:
 * <pre><code>
 *   "x-kubernetes-group-version-kind": [
 *   {
 *       "group": "apps",
 *       "kind": "Deployment",
 *       "version": "v1beta1"
 *   }]
 * </code></pre>
 *
 * Above node specifies the schema to match the following yaml:
 * <pre><code>
 * apiVersion: extensions/v1beta1
 * kind: Deployment
 * metadata:
 *  name: my-app
 * spec:
 *   replicas: 2
 * </code></pre>
 */
export interface KubernetesGroupKindNode {
    group?: string;
    version: string;
    kind: string;
}

/**
 * The base model for all kubernetes manifest objects, eg: Pod, Service, Deployment.
 */
export interface KubernetesResourceObjectBase {
    apiVersion: string;
    kind: string;
}