const vscode = acquireVsCodeApi();
let fullPageContent = {};
let fpcCounter = 0;
let schemaColors;
let defaultContainer;
let renderNonce = 0;
let isToBottom = true;
let lastScrollTop = 0;
let typingTimer;

window.addEventListener('message', (event) => {
    const message = event.data;
    switch (message.command) {
        case 'init': {
            const containers = message.containers;
            schemaColors = JSON.parse(message.colors);
            if (containers.length === 1) {
                defaultContainer = containers[0];
                return;
            }

            const containersPanel = document.getElementById('containers-panel');
            containersPanel.classList.remove('display-none');
            containersPanel.classList.add('display-inline-block');

            const select = createElement('vscode-select');
            select.setAttribute('id', 'containers-select');
            // eslint-disable-next-line @typescript-eslint/prefer-for-of
            for (let i = 0; i < containers.length; i += 1) {
                const option = createElement('vscode-option', containers[i], containers[i]);
                if (i === 0) {
                    option.setAttribute('selected', '');
                }
                select.appendChild(option);
            }
            containersPanel.appendChild(select);
        }
        case 'content': {
            const text = message.text;
            if (!text) {
                return;
            }
            const newContent = text.split('\n');
            updateContent(newContent);
        }
    }
});

function debounce(func, wait, immediate) {
    let timeout;
    return function () {
        const context = this, args = arguments;
        const later = function () {
            timeout = null;
            if (!immediate) {
                func.apply(context, args);
            }
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) {
            func.apply(context, args);
        }
    };
}

function beautifyLines(contentLines, from, to) {
    const content = {};
    if (Object.keys(contentLines).length === 0) {
        return content;
    }
    for (let i = from; i < to; i += 1) {
        let row = contentLines[i];
        if (!row) {
            break;
        }
        row = row.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        if (isHighlightEnabled()) {
            row = highlightWords(row);
        }
        row = /\n$/.test(row) ? row : `${row}\n`;
        content[i] = row;
    }
    return content;
}

function highlightWords(row) {
    if (!schemaColors) {
        return row;
    }
    // eslint-disable-next-line @typescript-eslint/prefer-for-of
    for (let i = 0; i < schemaColors.length; i += 1) {
        const rule = schemaColors[i];
        const regexp = new RegExp(rule.regex, "gi");
        if (regexp.test(row)) {
            row = row.replaceAll(regexp, repl);
            row = row.replaceAll('#ruleColor', rule.color);
        }
    }
    return row;
}

function repl() {
    const match = arguments[0];
    const offset = arguments[arguments.length - 2];
    const originalString = arguments[arguments.length - 1];
    if (!originalString) {
        return match;
    }
    const indexOpenSpan = originalString.substring(0, offset + match.length).lastIndexOf("<span");
    const indexCloseSpan = originalString.substring(0, offset + match.length).lastIndexOf("</span>");
    if (indexOpenSpan === -1 || indexOpenSpan < indexCloseSpan) {
        return `<span class="#ruleColor">${match}</span>`;
    } else {
        return match;
    }
}

function createElement(type, value, content) {
    const element = document.createElement(type);
    if (value) { element.value = value; }
    if (content) { element.textContent = content; }
    return element;
}

function init() {
    const runBtn = document.getElementById('runBtn');
    runBtn.addEventListener('click', (_event) => {
        changeVisibilityAfterRun();
        startLog();
    });

    const stopBtn = document.getElementById('stopBtn');
    stopBtn.addEventListener('click', (_event) => {
        changeVisibilityAfterStop();
        stopLog();
    });

    const clearBtn = document.getElementById('clearBtn');
    clearBtn.addEventListener('click', (_event) => {
        changeVisibilityAfterClear();
        clear();
    });

    const resetBtn = document.getElementById('resetBtn');
    resetBtn.addEventListener('click', (_event) => {
        reset();
    });

    const bottomBtn = document.getElementById('bottomBtn');
    bottomBtn.addEventListener('click', (_event) => {
        scrollToBottom();
    });

    const wrapChk = document.getElementById('wrap-chk');
    wrapChk.addEventListener('vsc-change', function (event) {
        if (event.detail.checked) {
            document.getElementById('content').classList.remove('white-space-pre');
            document.getElementById('content').classList.add('white-space-wrap');
        } else {
            document.getElementById('content').classList.remove('white-space-wrap');
            document.getElementById('content').classList.add('white-space-pre');
        }
    });

    const filterSelect = document.getElementById('filter-select');
    filterSelect.addEventListener('vsc-change', (_event) => {
        if (document.getElementById('filter-input').value) {
            runFilter();
        }
    });

    const filterInput = document.getElementById('filter-input');
    filterInput.addEventListener('keyup', (_event) => {
        if (document.getElementById('filter-select').value === 'all') {
            return;
        }
        if (typingTimer) {
            clearTimeout(typingTimer);
        }
        typingTimer = setTimeout(runFilter, 500);
    });

    const logPanel = document.getElementById('logPanel');
    const toBottom = debounce(function () {
        const st = logPanel.scrollTop;
        if (st > lastScrollTop) {
            // scroll down
            isToBottom = (logPanel.scrollTop + window.innerHeight) >= logPanel.scrollHeight;
        } else {
            // scroll up
            isToBottom = false;
        }
        lastScrollTop = st <= 0 ? 0 : st;
    }, 250);
    logPanel.addEventListener("scroll", toBottom);
}

function runFilter() {
    emptyContent();
    setContentDiv(filter());
}

function changeVisibilityAfterRun() {
    if (getToTerminal()) {
        return;
    }
    document.getElementById('runBtn').classList.add('display-none');
    if (isFollow()) {
        switchClass('stopBtn', 'display-none', 'display-inline-block');
    }
    switchClass('clearBtn', 'display-none', 'display-inline-block');
}

function changeVisibilityAfterClear() {
    switchClass('clearBtn', 'display-inline-block', 'display-none');

    if (!isFollow()) {
        switchClass('runBtn', 'display-none', 'display-inline-block');
    }
}

function changeVisibilityAfterStop() {
    switchClass('stopBtn', 'display-inline-block', 'display-none');

    if (isFollow()) {
        switchClass('runBtn', 'display-none', 'display-inline-block');
    }
}

function switchClass(id, classToRemove, classToAdd) {
    const element = document.getElementById(id);
    if (element.classList.contains(classToRemove)) {
        element.classList.remove(classToRemove);
    }
    if (!element.classList.contains(classToAdd)) {
        element.classList.add(classToAdd);
    }
}

function startLog() {
    const options = {
        container: getContainer(),
        follow: isFollow(),
        timestamp: document.getElementById('timestamp-chk').checked,
        since: getSinceDuration(),
        tail: getTail(),
        terminal: getToTerminal()
    };
    vscode.postMessage({
        command: 'start',
        options: JSON.stringify(options)
    });
}

function stopLog() {
    vscode.postMessage({
        command: 'stop'
    });
}

function clear() {
    fullPageContent = {};
    fpcCounter = 0;
    emptyContent();
}

function reset() {
    const containersSelect = document.getElementById('containers-select');
    if (containersSelect) {
        containersSelect.selectedIndex = 0;
    }
    document.getElementById('follow-chk').checked = false;
    document.getElementById('timestamp-chk').checked = false;
    document.getElementById('since-input').value = '0';
    document.getElementById('since-select').selectedIndex = 0;
    document.getElementById('tail-input').value = '-1';
    document.getElementById('terminal-chk').checked = false;
    document.getElementById('highlight-chk').checked = false;
}

function updateContent(newContent) {
    const content = {};
    let counter = 0;

    // eslint-disable-next-line @typescript-eslint/prefer-for-of
    for (let i = 0; i < newContent.length; i += 1) {
        if (newContent[i].length > 0) {
            content[counter] = newContent[i];
            fullPageContent[fpcCounter] = newContent[i];
            fpcCounter++;
            counter++;
        }
    }

    setContentDiv(filter(content));
    switchClass('clearBtn', 'display-none', 'display-inline-block');
}

function filter(logs) {
    const isNewLog = !!logs;
    const text = logs ? logs : fullPageContent;
    const filterInput = document.getElementById('filter-input').value;
    const mode = document.getElementById('filter-select').value;
    let content = {};
    if (filterInput.length > 0 && mode !== 'all') {
        const regex = new RegExp(filterInput);
        switch (mode) {
            case 'include':
                content = filterByFunction(text, (value) => regex.test(value));
                break;
            case 'exclude':
                content = filterByFunction(text, (value) => !regex.test(value));
                break;
            case 'before':
                if (document.getElementById('content').textContent.length === 0 || !isNewLog) {
                    content = filterBefore(text, regex);
                }
                break;
            case 'after':
                if (isNewLog && document.getElementById('content').textContent.length !== 0) {
                    content = text;
                } else {
                    content = filterAfter(text, regex);
                }
                break;
            default:
                break;
        }
    } else {
        content = text;
    }

    return content;
}

function filterByFunction(text, func) {
    const content = {};
    let counter = 0;
    let innerCounter = 0;
    while (true) {
        const value = text[counter];
        if (!value) {
            break;
        }
        if (func(value)) {
            content[innerCounter] = value;
            innerCounter++;
        }
        counter++;
    }
    return content;
}

function filterBefore(text, regex) {
    const content = {};
    let counter = 0;
    while (true) {
        const value = text[counter];
        if (!value || regex.test(value)) {
            break;
        }
        content[counter] = value;
        counter++;
    }
    return content;
}

function filterAfter(text, regex) {
    const content = {};
    let counter = 0;
    let innerCounter = 0;
    let start = false;
    while (true) {
        const value = text[counter];
        if (!value) {
            break;
        }
        if (!start && regex.test(value)) {
            start = true;
        }
        if (start) {
            content[innerCounter] = value;
            innerCounter++;
        }
        counter++;
    }
    return content;
}

function emptyContent() {
    const contentDiv = document.getElementById('logPanel');
    let i = contentDiv.childNodes.length;
    while (i--) {
        contentDiv.removeChild(contentDiv.lastChild);
    }
    contentDiv.innerHTML = `<code id='content' class='white-space-pre'></code><a id='bottom'></a>`;
}

function setContentDiv(content) {
    setTimeout(setContentDivInternal, 0, content);
}

function setContentDivInternal(content) {
    renderNonce = Math.random();
    const currentNonce = renderNonce;

    // This is probably seems more complicated than necessary.
    // However, rendering large blocks of text are _slow_ and kill the UI thread.
    // So we split it up into manageable chunks to keep the UX lively.
    // Of course the trouble is then we could interleave multiple different filters.
    // So we use the random nonce to detect and pre-empt previous renders.
    let ix = 0;
    const step = isHighlightEnabled() ? 3000 : 80000;
    const fn = () => {
        if (renderNonce !== currentNonce) {
            return;
        }
        if (!content[ix]) {
            return;
        }
        const end = ix + step;
        const rows = beautifyLines(content, ix, end);
        setTimeout(render, 1, rows, ix);
        ix = end;
        setTimeout(fn, 0);
    };
    fn();
}

function render(content, from) {
    if (Object.keys(content).length === 0) {
        const fragment = document.createRange().createContextualFragment('No logs ...');
        document.getElementById('content').appendChild(fragment);
    } else {
        const contentToDisplay = concatenateObjectValuesAsString(content, from);
        const fragment = document.createRange().createContextualFragment(contentToDisplay);
        document.getElementById('content').appendChild(fragment);
        if (isToBottom) {
            scrollToBottom();
        }
    }
}

function concatenateObjectValuesAsString(object, ix) {
    let valuesConcatenated = '';
    while (true) {
        const value = object[ix];
        if (!value) {
            break;
        }
        valuesConcatenated += value;
        ix++;
    }
    return valuesConcatenated;
}

function scrollToBottom() {
    document.getElementById('bottom').scrollIntoView();
}

function getContainer() {
    const containersSelect = document.getElementById('containers-select');
    if (containersSelect) {
        return containersSelect.value;
    }
    return defaultContainer;
}

function isFollow() {
    return document.getElementById('follow-chk').checked;
}

function getSinceDuration() {
    const sinceType = document.getElementById('since-select').value;
    const sinceInput = document.getElementById('since-input').value;
    if (isNaN(sinceInput) || sinceInput <= 0 || sinceType.trim() === '') {
        return 0;
    }
    return `${sinceInput}${sinceType}`;
}

function getTail() {
    const tailValue = document.getElementById('tail-input').value;
    if (isNaN(tailValue) || tailValue <= 0) {
        return -1;
    }
    return tailValue;
}

function getToTerminal() {
    return document.getElementById('terminal-chk').checked;
}

function isHighlightEnabled() {
    return document.getElementById('highlight-chk').checked;
}

(function () {
    init();
})();