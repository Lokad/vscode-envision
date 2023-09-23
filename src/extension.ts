import * as vscode from 'vscode';
import * as path from 'path';
import { tokenizer } from './envisionHighlighter';
import { semanticProvider } from './envisionSemanticTokensProvider';
import * as https from 'https';

/**
 * Basic language definition describing the Envision language definition
 */
// export const envisionLangDef: monaco.languages.ILanguageExtensionPoint =
//     {
//         id: "envision",
//         extensions: ['.nvn'],
//         aliases: ['ENVISION', 'envision'],
//         mimetypes: ['envision'],
//     };

// // created as a function to be able to delay-execute it.
// export function createEnvisionConfiguration() : monaco.languages.LanguageConfiguration {
//     return {
//         // telling Monaco how to comment lines
//         comments: {
//             lineComment: "//",
//             blockComment: [ "/*", "*/" ]
//         },

//         // telling how to auto close
//         brackets: [
//             ['[', ']'],
//             ['(', ')'],
//             ['{', '}'],
//             ["'", "'"],
//             ['"', '"'],
//             ['/*', '*/']
//         ],

//         // empty line at the end of the block are not in the
//         // current block
//         folding: {
//             offSide: true
//         },

//         onEnterRules: [
//             // indent after show... with
//             { beforeText: /^[ \t]*show.+with/
//             , action: { indentAction: monaco.languages.IndentAction.Indent }
//             },
//             // indent after def ... with
//             { beforeText: /^[ \t]*def.+with/
//             , action: { indentAction: monaco.languages.IndentAction.Indent }
//             },
//             // indent after each ... with
//             { beforeText: /each.*with/
//             , action: { indentAction: monaco.languages.IndentAction.Indent }
//             },
//             // indent after where|when (but not keep when/where)
//             { beforeText: /^[ \t]*(where|when)[ \t].*/
//             , action: {  indentAction: monaco.languages.IndentAction.Indent }
//             },
//             // indent read... with
//             { beforeText: /^read[ \t].*with$/
//             , action: { indentAction: monaco.languages.IndentAction.Indent }
//             }
//         ]
//     }
// }

function activate(context: vscode.ExtensionContext) {

    context.subscriptions.push(vscode.languages.registerDocumentSemanticTokensProvider(
        { language: 'envision' }, 
        semanticProvider.EnvisionProvider, 
        semanticProvider.EnvisionLegend
    ));

    // let disposable = vscode.commands.registerCommand('lokad-envision.compile', async function () {
    //     // Get the active text editor
    //     const editor = vscode.window.activeTextEditor;

    //     if (editor) {
    //         const document = editor.document;

    //         // Make sure the document is of type Envision
    //         if (document.languageId === 'envision') {
    //             const scriptContent = document.getText();

    //             // Define HTTP options
    //             const options = {
    //                 hostname: 'try.lokad.com',
    //                 path: '/w/script/trycompile',
    //                 method: 'POST',
    //                 headers: {
    //                     'Content-Type': 'text/plain',
    //                     'Content-Length': Buffer.byteLength(scriptContent)
    //                 }
    //             };

    //             const req = https.request(options, (res) => {
    //                 let responseBody = '';

    //                 res.on('data', (chunk) => {
    //                     responseBody += chunk;
    //                 });

    //                 res.on('end', () => {
    //                     try {
    //                         const data: TryCompileResponse = JSON.parse(responseBody);

    //                         if (data.IsCompOk) {
    //                             vscode.window.showInformationMessage('Compilation successful');
    //                         } else {
    //                             // Show errors
    //                             data.CompMessages.forEach(msg => {
    //                                 vscode.window.showErrorMessage(`Line ${msg.Line}: ${msg.Text}`);
    //                             });
    //                         }
    //                     } catch (error) {
    //                         vscode.window.showErrorMessage('Failed to compile. Error: ' + error);
    //                     }
    //                 });
    //             });

    //             req.write(scriptContent);
    //             req.end();
    //         }
    //     }
    // });

    // context.subscriptions.push(disposable);
}

exports.activate = activate;

// Define the TryCompileResponse type that you expect to get from your Envision client
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