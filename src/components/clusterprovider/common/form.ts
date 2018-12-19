import { formStyles, styles, waitScript } from '../../../wizard';
import { NEXT_FN } from '../../wizard/wizard';
import { SENDING_STEP_KEY } from '../clusterproviderserver';

// HTML rendering boilerplate

const DO_NOT_PROPAGATE = ['nextStep', SENDING_STEP_KEY];

export function propagationFields(previousData: any): string {
    let formFields = "";
    for (const k in previousData) {
        if (DO_NOT_PROPAGATE.indexOf(k) < 0) {
            formFields = formFields + `<input type='hidden' name='${k}' value='${previousData[k]}' />\n`;
        }
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
            <div id='content'>
            <form id='form'>
            <input type='hidden' name='nextStep' value='${fd.nextStep}' />
            ${propagationFields(fd.previousData)}
            ${fd.formContent}
            <p>
            <button onclick='${NEXT_FN}' class='link-button'>${fd.submitText} &gt;</button>
            </p>
            </form>
            </div>`;
}
