import { HelmV1 } from "../../contract/helm/v1";
import { helmExecAsync } from "../../../helm.exec";
import { parseCommandLine } from '../../../utils/command-line';

export function impl(): HelmV1 {
    return new HelmV1Impl();
}

export function parseHelmV1Command(command: string): string[] | undefined {
    const parsed = parseCommandLine(command);
    return parsed.succeeded ? parsed.args : undefined;
}

class HelmV1Impl implements HelmV1 {
    async invokeCommand(command: string): Promise<HelmV1.ShellResult | undefined> {
        const parsed = parseCommandLine(command);
        if (!parsed.succeeded) {
            return { code: -1, stdout: '', stderr: parsed.error };
        }
        return helmExecAsync(parsed.args);
    }
}
