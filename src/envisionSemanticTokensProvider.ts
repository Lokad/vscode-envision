import * as vscode from 'vscode';
import { tokenizer } from './envisionHighlighter';

const tokenTypes = [
    'normal', 
    'callable', // an identifier of a function
    'type',  // a built-in data type
    'keyword', 
    'option',
    'subkeyword', // a contextual keyword
    'table', // an identifier referencing a table
    'dim',   // an identifier referencing a primary dimension
    'number', 
    'string', 
    'operator', 
    'docs',   // structured comment
    'doctag',  // structured comment
    'comment',  // comment
    'md',   // a Markdown raw string literal
    'module',  // a 'module' block
    'schema',  // a 'schema' block
    'space',  // whitespace
    'ident' // identifier
];

const envisionTokenTypes = [
    'envision_normal', 
    'envision_callable',
    'envision_type',
    'envision_keyword', 
    'envision_option',
    'envision_subkeyword',
    'envision_table',
    'envision_dim',
    'envision_number', 
    'envision_string', 
    'envision_operator', 
    'envision_docs',
    'envision_doctag',
    'envision_comment',
    'envision_md',
    'envision_module',
    'envision_schema',
    'envision_space', 
    'envision_ident'
];

const tokenModifiers: string[] = [];

const EnvisionLegend = new vscode.SemanticTokensLegend(envisionTokenTypes, tokenModifiers);

class EnvisionSemanticTokensProvider implements vscode.DocumentSemanticTokensProvider {
    provideDocumentSemanticTokens(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.ProviderResult<vscode.SemanticTokens> {
        const tokens = this._parseTokens(document);
        return new vscode.SemanticTokens(new Uint32Array(tokens));
    }

    _parseTokens(document: vscode.TextDocument): number[] {

        var state = tokenizer.getInitialState();
        const tokens = [];
        
        // Your envisionHighlighter.ts tokenizer needs to return the tokenized lines
        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i).text;
            const isLineEmpty = document.lineAt(i).isEmptyOrWhitespace;
            const lineTokens = tokenizer.tokenize(line, state);

            if (isLineEmpty) {

                tokens.push(1); //Go to next line
                tokens.push(0); //Token start character
                tokens.push(1); //Token length (treat empty line as one space)
                tokens.push(tokenTypes.indexOf('space'));
                tokens.push(0); // No modifiers for now, hence 0

            } else {

                let prevStart = 0;
                for(let j = 0; j < lineTokens.tokens.length; j++) {
                    const token = lineTokens.tokens[j];
    
                    let nextStart = j + 1 < lineTokens.tokens.length 
                        ? lineTokens.tokens[j + 1].startIndex 
                        : line.length;
    
                    const tokenType = tokenTypes.indexOf(token.scopes);
    
                    // token line number, relative to the previous token
                    tokens.push(i == 0 ? 0 : (j == 0 ? 1 : 0));
    
                    // token start character, relative to the previous token 
                    // (relative to 0 or the previous token's start if they are on the same line)
                    tokens.push(token.startIndex - prevStart); 
    
                    // the length of the token. A token cannot be multiline.
                    tokens.push(nextStart - token.startIndex); 
    
                    // will be looked up in SemanticTokensLegend.tokenTypes.
                    tokens.push(tokenType);
    
                    tokens.push(0);  // No modifiers for now, hence 0
                    prevStart = token.startIndex;

                }
            }
        }
        
        return tokens;
    }
}

export const semanticProvider = {
    EnvisionProvider : new EnvisionSemanticTokensProvider(),
    EnvisionLegend
}
