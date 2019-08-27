import { Kubectl } from "../../kubectl";
import * as activeValueTracker from "./active-value-tracker";
import { ActiveValueTracker } from "./active-value-tracker";
import { getCurrentContext } from "../../kubectlUtils";

const ACTIVE_CONTEXT_POLL_INTERVAL_MS = 60000;  // Hopefully people in the extension will mostly change contexts through the extension, and if not they may have to make do with a delay

export function create(kubectl: Kubectl): ActiveValueTracker<string | null> {
    return activeValueTracker.create(() => getActiveContextName(kubectl), ACTIVE_CONTEXT_POLL_INTERVAL_MS);
}

async function getActiveContextName(kubectl: Kubectl): Promise<string | null> {
    const currentContext = await getCurrentContext(kubectl);
    if (!currentContext) {
        return null;
    }
    return currentContext.contextName;
}
