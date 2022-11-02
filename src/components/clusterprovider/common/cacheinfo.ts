import moment = require('moment');
import * as vscode from 'vscode';
import { getMinikubeShowInfoState } from "../../config/config";

export enum ShowInformationOptions {
    Install = "Install",
    InstallFortNightly = "Remind me in 2 weeks",
    InstallHalfYearly = "Remind me in 6 months",
}

/*
    This work is done specifically from the feedback from community for minikube or helm.

    The idea is that for those 2 we will have custom dialog boxes with options to be reminder dialog box,
    in every x-days.

    Now for example: Now when "Minikube upgrade available to x.xx, currently on x.xy" informationMessage
    we display user with 3 buttons to choose from:

    Option 1: Install (which is normal behaviour)
    Option 2: Install fortnightly - which we will cache as expiration date.
    Option 3: Install Half Yearly - which we will cache as expiration date.

    At the extension.ts level we check if there is a cached value for the minikubereminder, if so and its
    currently valid, then no message will be displayed otherwise show informaionmessage will popup for the end user.
*/

export async function isMinikubeInfoDisplay() {
    const showInfoExpiration = await getMinikubeShowInfoState();
    return isCacheExpired(showInfoExpiration);
}

export function getCacheExpirationDate(expiration: string) {
    let expirationDate = new Date();
    switch (expiration) {
        case ShowInformationOptions.InstallFortNightly:
            expirationDate.setTime(expirationDate.getTime() + 15 * 24 * 3600000);
            return expirationDate;
        case ShowInformationOptions.InstallHalfYearly:
            expirationDate = new Date();
            expirationDate.setTime(expirationDate.getTime() + 180 * 24 * 3600000);
            return expirationDate;
        default:
            console.log("No cache expiration exists!");
            return;
    }
}

function isCacheExpired(expiration: string | undefined): boolean {
    if (expiration === undefined || !expiration) {
        return true;
    }

    if (!isValidDate(expiration)) {
        vscode.window.showErrorMessage("Date format saved for vs-kubernetes.minikube-show-information-expiration is invalid format.")
        return true;
    }

    return new Date(expiration) <= new Date();
}

export function isValidDate(date: string): boolean {
    const dateformat = moment(date);
    return dateformat.isValid();
}
