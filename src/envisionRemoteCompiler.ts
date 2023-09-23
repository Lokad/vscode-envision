import * as vscode from 'vscode';
import * as https from 'https';

interface TryCompileResponse {
    IsCompOk: boolean;
    CompMessages: Array<{
        Text: string;
        Line: number;
        Start: number;
        Length: number;
        Severity: string;
    }>;
}

const envisionDiagnostics = vscode.languages.createDiagnosticCollection('envision');

export function compileEnvisionScript() {
    const editor = vscode.window.activeTextEditor;

    if (editor) {
        const document = editor.document;

        if (document.languageId === 'envision') {
            const scriptContent = document.getText();

            // Convert script to the expected JSON format
            const payload = JSON.stringify({
                Script: scriptContent
            });

            const options = {
                hostname: 'try.lokad.com',
                path: '/w/script/trycompile',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payload)
                }
            };

            const req = https.request(options, (res) => {
                let responseBody = '';

                res.on('data', (chunk) => {
                    responseBody += chunk;
                });

                res.on('end', () => {
                    try {
                        const data: TryCompileResponse = JSON.parse(responseBody);
                
                        if (data.IsCompOk) {
                            vscode.window.showInformationMessage('Compilation successful');
                            // Clear any previous diagnostics
                            envisionDiagnostics.clear();
                        } else {
                            const diagnostics: vscode.Diagnostic[] = [];
                
                            data.CompMessages.forEach(msg => {
                                vscode.window.showErrorMessage(`Line ${msg.Line}: ${msg.Text}`);
                                const range = new vscode.Range(msg.Line - 1, 0, msg.Line - 1, Number.MAX_VALUE);
                                const diagnostic = new vscode.Diagnostic(range, msg.Text, vscode.DiagnosticSeverity.Error);
                                diagnostics.push(diagnostic);
                            });
                
                            // Attach diagnostics to the current document
                            envisionDiagnostics.set(document.uri, diagnostics);
                        }
                    } catch (error) {
                        vscode.window.showErrorMessage('Failed to compile. Error: ' + error);
                    }
                });
            });

            req.write(payload);
            req.end();
        }
    }
}
