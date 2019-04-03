import { HelmV1 } from "../../contract/helm/v1";
import { helmExecAsync } from "../../../helm.exec";

export function impl(): HelmV1 {
    return new HelmV1Impl();
}

class HelmV1Impl implements HelmV1 {
    invokeCommand(command: string): Promise<HelmV1.ShellResult | undefined> {
        return helmExecAsync(command);
    }
}
