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
            .vscode-light #theme-canary {
                display: none;
                visibility: hidden;
            }
            .vscode-dark #theme-canary {
                display: none;
                visibility: visible;
            }
        </style>
        <script>
        function styleme() {
            // TODO: shameful, shameful, shameful
            var vscodeStyles = document.getElementById('_defaultStyles');
            var contentFrame = document.getElementById('contentFrame');
            var embeddedDocStyles = contentFrame.contentDocument.getElementById('styleholder');
            embeddedDocStyles.textContent = vscodeStyles.textContent;
            var b = document.getElementById('theme-canary');
            var canary = window.getComputedStyle(b).visibility;
            var theme = (canary === 'hidden') ? 'vscode-light' : 'vscode-dark';
            contentFrame.contentDocument.body.setAttribute('class', theme);
        }
        </script>
    </head>
    <body>
        <p id='theme-canary'>Theme canary - if you see this, it's a bug</p>
        <iframe id='contentFrame' src='${clusterproviderserver.url()}' onload='styleme()' />
    </body>
    </html>`;
}
