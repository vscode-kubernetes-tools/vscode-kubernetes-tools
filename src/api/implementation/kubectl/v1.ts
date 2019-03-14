import { KubectlV1 } from "../../contract/kubectl/v1";
import { Kubectl } from "../../../kubectl";

export function impl(kubectl: Kubectl): KubectlV1 {
    return new KubectlV1Impl(kubectl);
}

class KubectlV1Impl implements KubectlV1 {
    constructor(private readonly kubectl: Kubectl) {}

    invokeCommand(command: string): Promise<KubectlV1.ShellResult | undefined> {
        return this.kubectl.invokeAsync(command);
    }
}
