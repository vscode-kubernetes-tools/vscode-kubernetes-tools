'use strict';

import * as clusterproviderregistry from './clusterproviderregistry';
// import * as clusterproviderserver from './clusterproviderserver';

export async function renderWizardContainer(action: clusterproviderregistry.ClusterProviderAction): Promise<string> {
    return '';
//     await clusterproviderserver.init();

//     return `
//     <html>
//     <head>
//         <style>
//             html, body {
//                 width: 100%;
//                 height: 100%;
//             }
//             iframe {
//                 width: 100%;
//                 height: 100%;
//                 border: 0px;
//             }
//         </style>
// <!--        <style>
//             html, body {
//                 width: 100%;
//                 height: 100%;
//             }
//             iframe {
//                 width: 100%;
//                 height: 100%;
//                 border: 0px;
//             }
//             .vscode-light #theme-canary {
//                 display: none;
//                 visibility: hidden;
//             }
//             .vscode-dark #theme-canary {
//                 display: none;
//                 visibility: visible;
//             }
//         </style>
//         <script>
//         function styleme() {
//             // TODO: shameful, shameful, shameful
//             var vscodeStyles = document.getElementById('_defaultStyles');
//             var contentFrame = document.getElementById('contentFrame');
//             var embeddedDocStyles = contentFrame.contentDocument.getElementById('styleholder');
//             embeddedDocStyles.textContent = vscodeStyles.textContent;
//             var b = document.getElementById('theme-canary');
//             var canary = window.getComputedStyle(b).visibility;
//             var theme = (canary === 'hidden') ? 'vscode-light' : 'vscode-dark';
//             contentFrame.contentDocument.body.setAttribute('class', theme);
//         }
//         </script>
//     </head>
//     -->
//     <body>
//         <!--<p id='theme-canary'>Theme canary - if you see this, it's a bug</p>-->
//         <iframe id='contentFrame' src='${clusterproviderserver.url(action)}' />
//     </body>
//     </html>`;
}
