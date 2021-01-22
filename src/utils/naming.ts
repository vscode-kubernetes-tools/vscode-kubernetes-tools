export function timestampText(): string {
    const date = new Date();  // Not caring much about UTC vs local for naming purposes
    const year = zeroPad(date.getFullYear(), 4);
    const month = zeroPad(date.getMonth() + 1, 2);
    const day = zeroPad(date.getDate(), 2);
    const hour = zeroPad(date.getHours(), 2);
    const minute = zeroPad(date.getMinutes(), 2);
    const second = zeroPad(date.getSeconds(), 2);
    return `${year}${month}${day}-${hour}${minute}${second}`;
}

export function zeroPad(n: number, length: number): string {
    // This isn't optimised because it doesn't have to be
    let s = n.toString();
    while (s.length < length) {
        s = '0' + s;
    }
    return s;
}
