import { formStyles, styles, waitScript } from '../../../wizard';

// HTML rendering boilerplate

export function propagationFields(previousData: any): string {
    let formFields = "";
    for (const k in previousData) {
        formFields = formFields + `<input type='hidden' name='${k}' value='${previousData[k]}' />\n`;
    }
    return formFields;
}

interface FormData {
    stepId: string;
    title: string;
    waitText: string;
    action: string;
    nextStep: string;
    submitText: string;
    previousData: any;
    formContent: string;
}

export function formPage(fd: FormData): string {
    return `<!-- ${fd.stepId} -->
            <h1 id='h'>${fd.title}</h1>
            ${formStyles()}
            ${styles()}
            ${waitScript(fd.waitText)}
            <div id='content'>
            <form id='form' action='${fd.action}?step=${fd.nextStep}' method='post' onsubmit='return promptWait();'>
            ${propagationFields(fd.previousData)}
            ${fd.formContent}
            <p>
            <button type='submit' class='link-button'>${fd.submitText} &gt;</button>
            </p>
            </form>
            </div>`;
}
