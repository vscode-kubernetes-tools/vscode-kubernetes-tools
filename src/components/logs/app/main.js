const vscode = acquireVsCodeApi();
const fullPageContent = [];
let schemaColors;
let defaultContainer;
let renderNonce = 0;
let isToBottom = true;
let lastScrollTop = 0;

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
            updateContent(newContent, false);

            // handle auto-scroll on/off
            if (isToBottom) {
                scrollToBottom();
            }
        }
    }
});

function debounce(func, wait, immediate) {
    let timeout;
    return function() {
        const context = this, args = arguments;
        const later = function() {
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

function beautifyContentLineRange(contentLines, ix, end) {
    if (ix && end) {
        contentLines = contentLines.slice(ix, end);
    }
    return beautifyLines(contentLines);
};

function beautifyLines(contentLines) {
    if (!contentLines) {
        return '';
    }
    let content = contentLines.join('\n');
    if (content) {
        content = content.match(/\n$/) ? content : content + '\n';
        content = highlightWords(content);
    }
    return content;
}

function highlightWords(content) {
    if (!schemaColors) {
        return content;
    }
    for (const rule of schemaColors) {
        const regexp = new RegExp(rule.regex, "gi");
        content = content.replaceAll(regexp, repl);
        content = content.replaceAll('#ruleColor', rule.color);
    }
    return content;
}

function repl(match, _word, offset, originalString) {
    if (!originalString) {
        return match;
    }
    const indexOpenSpan = originalString.substring(0, offset + match.length).lastIndexOf("<span");
    const indexCloseSpan = originalString.substring(0, offset + match.length).lastIndexOf("</span>");
    if (indexOpenSpan === -1) {
        return `<span style="color:#ruleColor">${match}</span>`;
    } else if (indexOpenSpan !== -1 && indexCloseSpan === -1) {
        return match;
    } else if (indexOpenSpan < indexCloseSpan) {
            return `<span style="color:#ruleColor">${match}</span>`;
    } else {
        return match;
    }
}

function filterNewLogs(logsText) {
    return filter(logsText);
}

function filter(logs) {
    let isNewLog = false;
    let text = fullPageContent;
    if (logs) {
        isNewLog = true;
        text = logs;
    }
    const filterInput = document.getElementById('filter-input').value;
    const mode = document.getElementById('filter-select').value;
    let content;
    if (filterInput.length > 0 && mode !== 'all') {
        const regex = new RegExp(filterInput);
        switch (mode) {
            case 'include':
                content = text.filter((line) => regex.test(line));
                break;
            case 'exclude':
                content = text.filter((line) => !regex.test(line));
                break;
            case 'before':
                content = [];
                if (!isNewLog) {
                    for (const line of text) {
                        if (regex.test(line)) {
                            break;
                        }
                        content.push(line);
                    }
                }
                break;
            case 'after':
                if (isNewLog) {
                    content = text;
                } else {
                    const i = text.findIndex((line) => {
                        return regex.test(line);
                    });
                    content = text.slice(i+1);
                }
                break;
            default:
                content = [];
                break;
        }
    } else {
        content = text;
    }

    return content;
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

    const bottomBtn= document.getElementById('bottomBtn');
    bottomBtn.addEventListener('click', (_event) => {
        scrollToBottom();
    });

    const wrapChk = document.getElementById('wrap-chk');
    wrapChk.addEventListener('vsc-change', function(event) {
        const contentDiv = document.getElementById('content');
        if (event.detail.checked) {
            contentDiv.classList.remove('white-space-pre');
            contentDiv.classList.add('white-space-wrap');
        } else {
            contentDiv.classList.remove('white-space-wrap');
            contentDiv.classList.add('white-space-pre');
        }
    });

    const filterSelect = document.getElementById('filter-select');
    filterSelect.addEventListener('vsc-change', (_event) => {
        runFilter();
    });

    const filterInput = document.getElementById('filter-input');
    filterInput.addEventListener('keyup', (_event) => {
        runFilter();
    });

    const logPanel = document.getElementById('logPanel');
    const toBottom = debounce(function() {
        const st = logPanel.scrollTop;
        if (st > lastScrollTop){
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
    setTimeout(runFilterInternal, 0);
}

function runFilterInternal() {
// We use this to abort renders in progress if a new render starts
    renderNonce = Math.random();
    const currentNonce = renderNonce;

    const content = filter();

    const contentDiv = document.getElementById('content');
    contentDiv.textContent = !isFollow() ? 'No logs ...' : '';

    // This is probably seems more complicated than necessary.
    // However, rendering large blocks of text are _slow_ and kill the UI thread.
    // So we split it up into manageable chunks to keep the UX lively.
    // Of course the trouble is then we could interleave multiple different filters.
    // So we use the random nonce to detect and pre-empt previous renders.
    let ix = 0;
    const step = 1000;
    const fn = () => {
        if (renderNonce !== currentNonce) {
            return;
        }
        if (ix >= content.length) {
            return;
        }
        const end = Math.min(content.length, ix + step);
        setContentDiv(beautifyContentLineRange(content, ix, end));
        ix += step;
        setTimeout(fn, 0);
    };
    fn();
}

function changeVisibilityAfterRun() {
    if (getToTerminal()) {
        return;
    }
    document.getElementById('runBtn').classList.add('display-none');
    if (isFollow()) {
        switchClass('stopBtn', 'display-none', 'display-inline-block');
    }
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
    fullPageContent.length = 0;
    updateContent(undefined, true);
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
}

function updateContent(newContent, clear) {
    const contentDiv = document.getElementById('content');
    if (clear) {
        contentDiv.innerHTML = '';
        return;
    }

    newContent.forEach((line) => {
        if (line.length > 0) {
            fullPageContent.push(line);
        }
    });
    const beautifiedLines = beautifyLines(filterNewLogs(newContent));
    setContentDiv(beautifiedLines);
    switchClass('clearBtn', 'display-none', 'display-inline-block');
}

function setContentDiv(content) {
    const contentDiv = document.getElementById('content');
    if (!isFollow()) {
        if (content === '') {
            contentDiv.innerHTML = 'No logs ...';
        } else {
            contentDiv.innerHTML = content;
        }
    } else {
        contentDiv.innerHTML += content;
    }
}

function scrollToBottom () {
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

(function() {
    init();
})();