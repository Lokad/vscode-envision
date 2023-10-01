import * as vscode from 'vscode';

export function getGlobalConfiguration(key?: string): any {

    return vscode.workspace.getConfiguration(key);

}

export function updateGlobaConfiguration(key: string, value: string | undefined): void {

    const configuration = getGlobalConfiguration();
    configuration.update(key, value, vscode.ConfigurationTarget.Global);

}