'use strict';

import { TextDocumentContentProvider, Uri, ProviderResult, CancellationToken } from 'vscode';
import * as clusterproviderutils from './components/clusterprovider/clusterproviderutils';

export const uriScheme : string = "k8sconfigure";

export function operationUri(operationId: string) : Uri {
    return Uri.parse(`${uriScheme}://operations/${operationId}`);
}

export function uiProvider() : TextDocumentContentProvider {
    return new UIProvider();
}

class UIProvider implements TextDocumentContentProvider {
    provideTextDocumentContent(uri: Uri, token: CancellationToken) : ProviderResult<string> {
        return clusterproviderutils.renderWizardContainer('configure');
    }
}
