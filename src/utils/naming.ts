import * as moment from 'moment';

export function timestampText(): string {
    return moment().format('YYYYMMDD-HHmmss');  // Not caring much about UTC vs local for naming purposes
}
