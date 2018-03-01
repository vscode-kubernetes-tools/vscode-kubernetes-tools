'use strict';

import { TextDocumentContentProvider, Uri, EventEmitter, Event, ProviderResult, CancellationToken, extensions } from 'vscode';
import { Shell } from './shell';
import { FS } from './fs';
import * as clusterproviderregistry from './components/clusterprovider/clusterproviderregistry';
import * as clusterproviderserver from './components/clusterprovider/clusterproviderserver';

export const uriScheme : string = "k8screatecluster";

export function operationUri(operationId: string) : Uri {
    return Uri.parse(`${uriScheme}://operations/${operationId}`);
}

export function uiProvider() : TextDocumentContentProvider {
    return new UIProvider();
}

class UIProvider implements TextDocumentContentProvider {
    provideTextDocumentContent(uri: Uri, token: CancellationToken) : ProviderResult<string> {
        return renderPromptForClusterType();
    }
}

function renderPromptForClusterType() : string {
    clusterproviderserver.init();

    return `
    <html>
    <head>
        <style>
            html, body {
                width: 100%;
                height: 100%;
            }
            iframe {
                width: 100%;
                height: 100%;
                border: 0px;
            }
        </style>
        <script>
        function styleme() {
            // TODO: shameful, shameful, shameful
            var vscodeStyles = document.getElementById('_defaultStyles');
            var contentFrame = document.getElementById('contentFrame');
            var embeddedDocStyles = contentFrame.contentDocument.getElementById('styleholder');
            embeddedDocStyles.textContent = vscodeStyles.textContent;
        }
        </script>
    </head>
    <body>
        <iframe id='contentFrame' src='${clusterproviderserver.url()}' onload='styleme()' />
    </body>
    </html>`;
}
