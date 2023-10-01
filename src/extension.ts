import * as vscode from 'vscode';
import { semanticProvider } from './envisionSemanticTokensProvider';
import { compileEnvisionScript } from './envisionRemoteCompiler';
import { getGlobalConfiguration, updateGlobaConfiguration } from './configurationUtil';

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

const colorThemeKey = 'workbench.colorTheme';
const envisionThemeName = 'Envision';

let initialTheme: string;

function activate(context: vscode.ExtensionContext): void {

    context.subscriptions.push(vscode.languages.registerDocumentSemanticTokensProvider(
        { language: 'envision' }, 
        semanticProvider.EnvisionProvider, 
        semanticProvider.EnvisionLegend
    ));

    context.subscriptions.push(vscode.commands.registerCommand('lokad-envision.compile', async function () {
        compileEnvisionScript();
    }));

    //undefined in case of default theme
    initialTheme = getGlobalConfiguration(colorThemeKey);

    updateGlobaConfiguration(colorThemeKey, envisionThemeName);

}

function deactivate(): void {

    const currentTheme = getGlobalConfiguration(colorThemeKey);

    //Go back to initial theme only if user didn't change it in a meantime
    if (currentTheme === envisionThemeName)
        updateGlobaConfiguration(colorThemeKey, initialTheme);

}

exports.activate = activate;
exports.deactivate = deactivate;
