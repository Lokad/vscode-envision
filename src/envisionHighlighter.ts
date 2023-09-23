// DO NOT TOUCH THIS FILE, YOUR CHANGE WILL BE OVERWRITTEN
// THIS FILE IS COPIED FROM ANOTHER LOKAD PROJECT.

// This highlighter is intended to be compatible with Monaco,
// but to improve compilation speed, it does _not_ reference the 
// Monaco modules at all. Instead, all the relevant types are 
// reproduced here, and the TypeScript structural type-checking
// is used to rely on them. 

// Monaco tokenization 'IState'
export interface IState {
    clone(): IState
    equals(other: IState): boolean
}

export interface IToken {
    startIndex: number
    scopes: string
}

// Monaco tokenization 'ILineTokens'
interface ILineTokens {
    endState: IState
    tokens: IToken[]
}

type Context = {
    readonly state: State
    readonly line: string
    readonly token: IToken
    readonly end: number
    readonly isEoL: boolean
}

type Action = (ctx: Context) => boolean|undefined

type State = IState & ({
    // When the previous line ended while inside a multi-line token. 
    readonly midToken: "markdown"|"comment"
    // If mid-token, there's a previous state to return to. 
    readonly prev: State
} | {
    readonly midToken: undefined
}) & {
    dims: Set<string>
    dimRegex: RegExp
    modules: Set<string>
    moduleRegex: RegExp
    action: Action
}

// True if the provided token is of the specified type, and 
// matches the provided regexp.
function is(
    ctx: Context,
    kind: string, 
    value: RegExp): boolean
{
    if (ctx.isEoL) return false;
    if (kind != ctx.token.scopes) return false;
    value.lastIndex = ctx.token.startIndex;
    return value.test(ctx.line) && value.lastIndex == ctx.end;
}

// True if the provided token is the specified single-character operator
function isCharOperator(
    ctx: Context,
    char: string) : boolean
{
    if (ctx.isEoL) return false;
    if (ctx.end > ctx.token.startIndex + 1) return false;
    if (ctx.token.scopes != tok_operator) return false;
    return char.charCodeAt(0) === ctx.line.charCodeAt(ctx.token.startIndex);
}

// Produce a regular expression that matches values in a set. 
// If several set values match, picks the longest one.
function regexFromSet(set: Set<string>) {
    const array = Array.from(set);
    // sort values by descending length, so that the longest one
    // is matched first
    array.sort(function(a, b) { return b.length - a.length });
    return new RegExp(array.join("|"), "iy");
}

// Save the provided string as a dimension name.
function saveAsDim(ctx: Context, dim: string) {
    if (!ctx.state.dims.has(dim)) {
        const newSet = ctx.state.dims = new Set(ctx.state.dims);
        newSet.add(dim);
        ctx.state.dimRegex = regexFromSet(newSet);
    }
}

// Save the provided string as a module name.
function saveAsModule(ctx: Context, mod: string) {
    if (!ctx.state.modules.has(mod)) {
        const newSet = ctx.state.modules = new Set(ctx.state.modules);
        newSet.add(mod);
        ctx.state.moduleRegex = regexFromSet(newSet);
    }
}

// If the context is an identifier (tok_normal), repaint it as a different
// token type (usually as a table), then return true.
function repaint(
    token: IToken,
    tok: string) : boolean
{
    token.scopes = tok;
    return true;
}

// Set the state's action and return true.
function setAction(ctx: Context, action: Action): boolean {
    ctx.state.action = action;
    return true;
}

// Set the state's action and invoke it on the context (delegating
// the current context to that action).
function delegateAction(ctx: Context, action: Action): boolean|undefined {
    setAction(ctx, action);
    return action(ctx);
}

// Sets a new action that expects the next token to be an identifier,
// which will be painted as a table. 
function consumeTableName(ctx: Context): boolean {
    
    const oldAction = ctx.state.action;
    return setAction(ctx, function(ctx: Context) {
        
        // Detect a module if present.
        if (act_module(ctx)) return true;

        // Regardless of the token found, restore the old action.
        setAction(ctx, oldAction);

        // If the token is an identifier, paint it as a table
        if (!ctx.isEoL && ctx.token.scopes === tok_normal) {
            ctx.token.scopes = tok_table;
            return true;
        }

        // If the token is _not_ an identifier, fall back to the old action.
        return oldAction(ctx);
    })
}

// Sets a new action that expects the current token to be an identifier,
// which will be painted as a schema. 
function consumeSchemaName(ctx: Context): boolean|undefined {
    
    const oldAction = ctx.state.action;
    function apply(ctx: Context) {
        
        // Detect a module if present.
        if (act_module(ctx)) return true;

        // Regardless of the token found, restore the old action.
        setAction(ctx, oldAction);

        // If the token is an identifier, paint it as a schema
        if (!ctx.isEoL && ctx.token.scopes === tok_normal) {
            ctx.token.scopes = tok_schema;
            return true;
        }

        // If the token is _not_ an identifier, fall back to the old action.
        return oldAction(ctx);
    }

    setAction(ctx, apply);
    return apply(ctx);
}

// Sets a new action that expects the next series of tokens to be 
// checked path elements, which will be painted as schema. 
function consumeCheckedPath(ctx: Context): boolean|undefined {
    
    const oldAction = ctx.state.action;
    function apply(ctx: Context): boolean|undefined {

        // Checked paths cannot be multi-line.
        if (!ctx.isEoL) {
            // Ignore slashes
            if (isCharOperator(ctx, "/")) 
                return true;

            // Open parenthesis stays open until closing parenthesis
            if (isCharOperator(ctx, "("))
                return setAction(ctx, parentheses);

            // Paint identifiers
            if (ctx.token.scopes === tok_normal) {
                ctx.token.scopes = tok_type;
                return true;
            }
        }        

        // Can't handle anything else, so return to parent action.
        setAction(ctx, oldAction);
        return oldAction(ctx);
    }

    function parentheses(ctx: Context): boolean|undefined {

        if (ctx.isEoL || ctx.token.scopes === tok_keyword) 
            return apply(ctx);

        if (isCharOperator(ctx, ")")) 
            return setAction(ctx, apply);
        
        return act_ident(ctx);
    }

    setAction(ctx, apply);
    return apply(ctx);
}

// ===========================================================================
// HIGHLIGHTING ACTIONS
// ===========================================================================

// This action is always tried if the other action fails. It detects that 
// something went wrong (usually a keyword is found where it was not 
// expected) and change to the appropriate state.
function act_fallback(ctx: Context) {
        
    if (ctx.isEoL) return;

    const kw = (re: RegExp) => is(ctx, tok_keyword, re);

    if (kw(/read/y))   return setAction(ctx, act_read);
    if (kw(/write/y))  return act_write(ctx);
    if (kw(/show/y))   return setAction(ctx, act_show);
    if (kw(/table/y))  return setAction(ctx, act_table);
    if (kw(/def/y))    return setAction(ctx, act_def);
    if (kw(/keep/y))   return setAction(ctx, act_keep);
    if (kw(/import/y)) return setAction(ctx, act_import);
    if (kw(/schema/y)) return setAction(ctx, act_schema);

    if (kw(/into|each|autodiff/y) || is(ctx, tok_operator, /<</y)) 
        return consumeTableName(ctx);    

    if (kw(/where|when|match|return/y) || isCharOperator(ctx, '='))
        // These restore normal rules by ending any special 
        // actions.  
        return setAction(ctx, act_fallback);

    return act_ident(ctx);
}

// After a 'schema' keyword
function act_schema(ctx: Context): boolean|undefined {
    
    if (isCharOperator(ctx, '/'))
        return consumeCheckedPath(ctx);

    if (is(ctx, tok_normal, /max/y)) {
        ctx.token.scopes = tok_keyword;
        return true;
    }

    if (!ctx.isEoL && ctx.token.scopes == tok_normal)
        return consumeSchemaName(ctx);

    if (is(ctx, tok_keyword, /with/y)) 
        return setAction(ctx, act_read_columns);
    
    // Ignore any tokens until end-of-line (usually, options)
    if (!ctx.isEoL)
        return true;

    return setAction(ctx, act_fallback);
}

// After a 'keep': special paint for 'process'. 
function act_keep(ctx: Context): boolean|undefined {
    if (!ctx.isEoL && is(ctx, tok_normal, /process/y))
        ctx.token.scopes = tok_subkeyword;
    return setAction(ctx, act_fallback);
}

// After an 'import' : main objective is to extract the module name. 
function act_import(ctx: Context): boolean|undefined {
    if (ctx.isEoL || is(ctx, tok_keyword, /with/y)) return setAction(ctx, act_fallback);

    if (ctx.token.scopes === tok_normal)
    {
        // Found the module name! 
        ctx.token.scopes = tok_module;
        saveAsModule(ctx, ctx.line.substring(ctx.token.startIndex, ctx.end));
        return setAction(ctx, act_fallback);
    }
}

// After a 'def' and before the first '('
function act_def(ctx: Context): boolean|undefined {
    if (ctx.isEoL) return setAction(ctx, act_fallback);
    if (is(ctx, tok_normal, /pure|process|nosort/y))
        return repaint(ctx.token, tok_subkeyword);
    if (is(ctx, tok_keyword, /autodiff|const/y))
        return true;
    if (ctx.token.scopes === tok_normal)
        return repaint(ctx.token, tok_callable);
    if (isCharOperator(ctx, '('))
        return setAction(ctx, act_def_args);
}

// After the '(' of a 'def' statement
function act_def_args(ctx: Context): boolean|undefined {
    if (ctx.isEoL) return setAction(ctx, act_fallback);
    if (ctx.token.scopes === tok_normal) return true;
    if (isCharOperator(ctx, ':')) return setAction(ctx, act_def_type);
}

// Encountering an identifier without any additional context: 
// can be painted as an option, a callable, a table or a module, 
// depending on what follows. Restores the current action when done.
function act_ident_opt(allowopt: boolean) {

    return function (ctx: Context): boolean|undefined {
    
        const unknownIdents : {
            paint: (color: string) => void
            isModule: boolean
            isDim: boolean
        }[] = [];
        
        const oldAction = ctx.state.action;

        if (ctx.token.scopes === tok_normal) {
            // We will probably see several identifiers separated
            // by '.' and we will not know what to do with them 
            // until we reach the final character, so we keep them
            // around. 
            unknownIdents.push(token(ctx));

            return setAction(ctx, afterIdent);
        }

        // Invoked on the token that follows each seen identifier 
        // (including the first).
        function afterIdent(ctx: Context): boolean|undefined {
            
            if (isCharOperator(ctx, '.')) 
                // Identifier followed by '.' means we need to consume
                // another thing now. What could it be ? 
                return setAction(ctx, function(ctx: Context) {
            
                    if (isCharOperator(ctx, '*') ||
                        ctx.token.scopes === tok_keyword || 
                        ctx.token.scopes === tok_subkeyword || 
                        ctx.token.scopes === tok_number ||
                        ctx.token.scopes === tok_string)
                    {
                        // Foo.* / Foo.true / Foo.123 / Foo."hello"
                        paintAsPrefix();
                        return delegateAction(ctx, oldAction);
                    }

                    if (isCharOperator(ctx, '/')) 
                    {
                        // Foo./checked/path
                        paintAsPrefix()
                        setAction(ctx, oldAction);
                        return consumeCheckedPath(ctx);
                    }

                    if (ctx.token.scopes === tok_normal)
                    {
                        // Foo.Bar (need to know what follows)
                        unknownIdents.push(token(ctx));
                        return setAction(ctx, afterIdent);
                    }

                    paintAsVariable();
                    return delegateAction(ctx, oldAction);
                });

            if (isCharOperator(ctx, '('))
            {
                // Identifier followed directly by '(' means a callable
                paintAsCallable();
                return delegateAction(ctx, oldAction);
            }

            if (allowopt && unknownIdents.length == 1 && isCharOperator(ctx, ':'))
            {
                // Identifier without dots, followed by ':', is likely an 
                // option name. 
                unknownIdents[0].paint(tok_option);
                return delegateAction(ctx, oldAction);
            }

            // Unexpected thing following an identifier: paint as a variable.
            paintAsVariable();
            return delegateAction(ctx, oldAction);
        }

        // Paint the chain of identifiers as a function Fun or Mod.Fun, 
        // with a special case for 'enum.Foo'
        function paintAsCallable() {

            if (unknownIdents.length > 0 && unknownIdents[0].isModule)
                unknownIdents.shift()!.paint(tok_module);            

            for (const t of unknownIdents) t.paint(tok_callable);
        }

        // Paint the chain of identifiers as a prefix Tbl, Mod or Mod.Tbl
        function paintAsPrefix() {

            if (unknownIdents.length > 0 && unknownIdents[0].isModule)
                unknownIdents.shift()!.paint(tok_module);

            for (const t of unknownIdents) t.paint(tok_table);
        }

        // Paint the chain of identifiers as a variable Var, Tbl.Var,
        // Mod.Var or Mod.Tbl.Var
        function paintAsVariable() {
            const last = unknownIdents.pop()!;
            if (last.isDim) last.paint(tok_dim);
            paintAsPrefix();
        }

        // Extract information about the current token of the 
        // context.
        function token(ctx: Context) {
            const token = ctx.token;
            return {
                isModule: is(ctx, tok_normal, ctx.state.moduleRegex),
                isDim: is(ctx, tok_normal, ctx.state.dimRegex),
                paint: function(color: string) { token.scopes = color }
            }
        }
    }
}

// Identifier processing versions that handle and do not handle
// options. 
const act_ident_noopt = act_ident_opt(false);
const act_ident = act_ident_opt(true);

// After a 'write' keyword.
function act_write(ctx: Context) {

    setAction(ctx, option);
    return consumeTableName(ctx);

    function option(ctx: Context): boolean|undefined {

        // After the table name, consume options
        if (!ctx.isEoL && ctx.token.scopes === tok_subkeyword) 
            return true;

        return setAction(ctx, act_fallback);
    }
}

// After a 'read' keyword. 
function act_read(ctx: Context) {
    
    if (ctx.isEoL) 
        // At end-of-line, if we have not reached a 'with', consider this
        // read statement complete.
        return setAction(ctx, act_fallback);

    if (is(ctx, tok_normal, /max|min|latest|upload|form|small|unsafe/y)) 
        // Contextual keywords are repainted as such.
        return repaint(ctx.token, tok_subkeyword);

    if (is(ctx, tok_keyword, /as/iy)) 
        // An 'as' introduces the name of the table being read. 
        return setAction(ctx, function(ctx: Context) {
            repaint(ctx.token, tok_table);
            return setAction(ctx, act_read);
        });

    if (isCharOperator(ctx, '[')) 
        // A '[' (either after the table name or the 'expect') introduces
        // a dimension definition scope.
        return setAction(ctx, act_read_dim);
        
    if (is(ctx, tok_keyword, /with/y))
        // The 'with' introduces the columns
        return setAction(ctx, act_read_columns);
}

// In a [..] inside a 'read' keyword.
function act_read_dim(ctx: Context) {

    if (ctx.isEoL) return setAction(ctx, act_fallback);

    if (ctx.token.scopes === tok_normal) {
        
        // We have seen a dimension: remember it and see what follows.
        const dimCandidateToken = ctx.token;
        const dimCandidateName = ctx.line.substring(dimCandidateToken.startIndex, ctx.end);
        if (dimCandidateName === "unsafe") {
            dimCandidateToken.scopes = tok_subkeyword;
            return true;
        }

        return setAction(ctx, function(ctx: Context) {
            
            if (ctx.isEoL) return setAction(ctx, act_fallback);

            // [col as dim] : the 'col' is not a dimension name! 
            if (is(ctx, tok_keyword, /as/y))
                return setAction(ctx, act_read_dim);

            const comma = isCharOperator(ctx, ',');
            const end = isCharOperator(ctx, ']');
            const unsafe = is(ctx, tok_normal, /unsafe/y);

            // 'dim]' or 'dim,' or 'dim unsafe'
            if (comma || end || unsafe)
            {
                saveAsDim(ctx, dimCandidateName);
                dimCandidateToken.scopes = tok_dim;
            }

            // Don't forget to paint 'unsafe' as a keyword, too.
            if (unsafe) ctx.token.scopes = tok_subkeyword;

            return setAction(ctx, end ? act_read : act_read_dim);
        });
    }

    // A 'with' means we have missed a ']' ; never mind, just assume it was there.
    if (is(ctx, tok_keyword, /with/y)) return setAction(ctx, act_read_columns);
}

// After the 'with' of a read: listing columns.
function act_read_columns(ctx: Context) {

    if (ctx.isEoL) return;

    // A '{' indicates Stylecode
    if (isCharOperator(ctx, '{')) return setAction(ctx, act_fallback);

    if (isCharOperator(ctx, ':')) return setAction(ctx, act_read_type);
    return act_ident_noopt(ctx);
}

const valuetypes = /number|date|month|week|boolean|ranvar|zedfunc|text|markdown|flagset/iy;

// After the ':' of a type specification in a read column or 'def'
function act_type(thenReturnTo: Action) {
    return function(ctx: Context) {

        if (ctx.isEoL || isCharOperator(ctx, ',') || isCharOperator(ctx, ';')) 
            return setAction(ctx, thenReturnTo);

        // Accept a 'table' token here while staying in the same logic, 
        // otherwise the act_fallback will pull back to global scope logic
        if (is(ctx, tok_keyword, /table/y)) return true;
            
        // An 'enum' (whether preceded by 'table' or not) can be 
        // followed by a possibly qualified table identifier, and a '[..]' 
        // dimension specification.
        if (is(ctx, tok_subkeyword, /enum/y)) {
            repaint(ctx.token, tok_subkeyword);
            
            return setAction(ctx, function(ctx) {

                // Consume module name if necessary.
                if (act_module(ctx)) return true;

                // If no table name, abort and have the outer context deal with this. 
                if (ctx.isEoL || ctx.token.scopes !== tok_normal) {
                    setAction(ctx, thenReturnTo);
                    return thenReturnTo(ctx);
                }

                // Paint token as a table, then expect a potential '[..]'
                ctx.token.scopes = tok_table;

                return setAction(ctx, function(ctx) {

                    if (ctx.isEoL || !isCharOperator(ctx, '[')) {
                        setAction(ctx, thenReturnTo);
                        return thenReturnTo(ctx);
                    }

                    // Found a '[' : expect a dimension name next.
                    return setAction(ctx, function(ctx) {

                        // Regardless of what we find here, return to previous state.
                        setAction(ctx, thenReturnTo);

                        if (!ctx.isEoL && ctx.token.scopes === tok_normal) {
                            
                            const dimCandidateToken = ctx.token;
                            const dimCandidateName = ctx.line.substring(dimCandidateToken.startIndex, ctx.end);
                            
                            saveAsDim(ctx, dimCandidateName);
                            return repaint(dimCandidateToken, tok_dim);
                        }

                        return thenReturnTo(ctx);
                    })
                })
            })
        } // End of 'enum' case

        if (is(ctx, tok_normal, valuetypes)) return repaint(ctx.token, tok_type);
    }
}

const act_read_type = act_type(act_read_columns);
const act_def_type = act_type(act_def_args);

// Between a 'table' and a '='
function act_table(ctx: Context) {

    if (ctx.isEoL) 
        return setAction(ctx, act_fallback);

    if (is(ctx, tok_normal, /enum|max|small/y))
    {
        // A 'table enum' statement, or a 'max' or 'small' subkeyword
        ctx.token.scopes = tok_subkeyword;
        return true;    
    }

    if (isCharOperator(ctx, '['))
        return setAction(ctx, act_table_dims);

    if (isCharOperator(ctx, '='))
        return setAction(ctx, act_table_def);

    if (ctx.token.scopes === tok_normal)
    {
        // Table names are painted.
        ctx.token.scopes = tok_table;
        return true;
    }
}

// Inside the definition of a table's primary dimension.
// The [..] after the table name.
function act_table_dims(ctx: Context) {

    if (ctx.isEoL) return setAction(ctx, act_fallback);
    if (isCharOperator(ctx, ']')) return setAction(ctx, act_table);

    if (ctx.token.scopes === tok_normal)
    {
        // A dimension ! Paint it as one, and remember it.
        saveAsDim(ctx, ctx.line.substring(ctx.token.startIndex, ctx.end))
        ctx.token.scopes = tok_dim;
        return true;
    }
}

// After a 'table X[k] =' and expecting a table definition
function act_table_def(ctx: Context) {

    if (ctx.isEoL) return setAction(ctx, act_fallback);
    
    if (is(ctx, tok_normal, /single|whichever|slice/y))
        return repaint(ctx.token, tok_keyword);

    if (is(ctx, tok_keyword, /cross/y))
        return setAction(ctx, act_table_def_cross);

    return true;
}

// After a 'table X[k] = cross' and expecting table names.
function act_table_def_cross(ctx: Context) {

    if (isCharOperator(ctx, ')') || ctx.isEoL || ctx.token.scopes == tok_keyword)
        return setAction(ctx, act_fallback);

    if (isCharOperator(ctx, '(') || isCharOperator(ctx, ','))
        return consumeTableName(ctx);

    return true;
}

// Immediately after a 'show': 
function act_show(ctx: Context) {
    // The first token after a 'show' is always painted as
    // subkeyword, even if it is e.g. a 'table' that would be 
    // painted as a keyword instead.
    if (!ctx.isEoL) ctx.token.scopes = tok_subkeyword;
    return setAction(ctx, act_fallback);
} 

// If it finds a module name, paints it as a module, then enters a parse-state 
// that waits for a dot, then returns to the current parse-state.
// If it does not find a module, immediatley return 'undefined'
function act_module(ctx: Context) {
    if (!is(ctx, tok_normal, ctx.state.moduleRegex)) return;
    // Paint as a module instead.
    ctx.token.scopes = tok_module;
    const oldAction = ctx.state.action;
    return setAction(ctx, function (ctx: Context) {
        if (ctx.isEoL || isCharOperator(ctx, '.')) { // Consume '.'
            ctx.state.action = oldAction;
            return true;
        }
    });
}

function getInitialState(): IState {

    const state : State = {
        midToken: undefined,
        dims: new Set(["date", "week", "month", "file", "slice"]),
        dimRegex: /date|week|month|file|slice/iy,
        modules: new Set(),
        moduleRegex: /!/iy,
        action: act_fallback,
        clone() { return {...this}; },
        equals(other: IState) {
            const o = other as State; 
            return this.midToken === o.midToken &&
                   this.dims === o.dims && 
                   this.modules === o.modules && 
                   this.action === o.action;
        }
    }

    return state;
}

const tok_normal = "normal"
const tok_callable = "callable"
const tok_type = "type"
const tok_keyword = "keyword"
const tok_option = "option"
const tok_subkeyword = "subkeyword"
const tok_table = "table"
const tok_dim = "dim"
const tok_number = "number"
const tok_string = "string"
const tok_operator = "operator"
const tok_docs = "docs"
const tok_doctag = "doctag"
const tok_comment = "comment"
const tok_markdown = "md"
const tok_module = "module"
const tok_schema = "schema";
export const tok_space = "space"
const tok_identifier = "ident"

export const tokenColors = [
    [tok_normal,     "D4D4D4", "383A42"], 
    [tok_identifier, "D4D4D4", "383A42"], 
    [tok_callable,   "DCDCAA", "986801"], 
    [tok_type,       "DCDCAA", "4078F2"],
    [tok_keyword,    "569CD6", "A626A4"],
    [tok_option,     "72CCF6", "4078F2"],
    [tok_subkeyword, "72CCF6", "A626A4"],
    [tok_table,      "4EC9B0", "0184BC"],
    [tok_dim,        "E5D448", "E45649"],
    [tok_number,     "B5CEA8", "116644"],
    [tok_string,     "CE9178", "50A14F"],
    [tok_operator,   "D4D4D4", "696C77"], 
    [tok_docs,       "6DB34F", "A0A1A7"], 
    [tok_comment,    "608B4E", "A0A1A7"],
    [tok_markdown,   "FEDBA0", "50A14F"], 
    [tok_module,     "CAA6F7", "CA1243"],
    [tok_schema,     "E16085", "986801"],
    [tok_doctag,     "61E32A", "7B7C86"],
    [tok_space,      "FF0000", "FF0000"]
]

const tokenRegex = 
//     idents/keywords      text and schema literals                  hex colors                  number literals                         
//     vvvvvvvvvvvvvvvv     vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv           vvvvvvvvvvvvvvvvvvvvvvvvvvv vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv                                                
  /\s+|[a-z_][a-z_0-9]+|"""|"([^\\"]|\\.)*"|'([^\\']|\\.)*'|\/\/|\/\*|#?[0-9a-f]{3}([0-9a-f]{3})?|[0-9]+(\\.[0-9]+)?(e[+-]?[0-9]+)?[kmb]?|\[\|?|\|?]|\/\.?|==?|<[=<]?|>[=>]?|!=|~~?|!~|->|\.\.?|[-:?{}()^@#*_+]|./ig
// ^^^                  ^^^                                 ^^^^^^^^^                                                                     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^  
// space                markdown                            comments                                                                      operators

const endMarkdownRegex = /(?<!\\)"""/g

// This will indicate either the end of a multi-line comment /* or
// the start of a nested multi-line comment */
const endCommentRegex = /\*\/|\/\*/g

const keywords = new RegExp('(?:' + [
    "const", "when", "where", "group", "order", "keep", "else", "return",
    "with", "draw", "loop", "params", "match", "span", "into", "table", 
    "expect", "show", "read", "def", "each", "loop", "autodiff", "by", 
    "default", "if", "sort", "at", "over", "desc", "cross", "as", "scan",
    "import", "export", "montecarlo", "sample", "fail", "then", "schema",
    "write", "delete", "shared", "for"
].join('|') + ')(?!\\w)', "y");

function isKeyword(line: string, start: number) {
    keywords.lastIndex = start;
    return keywords.test(line);
}

const subkeywords = new RegExp('(?:' + [
    "mod", "not", "or", "and", "in", "true", "false", "abstract", "auto", 
    "enum", "partitioned"
].join('|') + ')(?!\\w)', "y")

function isSubKeyword(line: string, start: number) {
    subkeywords.lastIndex = start;
    return subkeywords.test(line);
}

function regexMatch(re: RegExp, str: string, start: number, end: number) {
    re.lastIndex = start;
    return (re.test(str) && re.lastIndex == end);
}

const interpolationRegex = 
// intro                        var name                                         var name                                    var name                                    var name                 
// vvvv                         vvvvvvvvvvvvvvv                                  vvvvvvvvvvvvvvv                             vvvvvvvvvvvvvvv                             vvvvvvvvvvvvvvv
  /\\\{(?:(?:[a-z][a-z0-9_]*\.)*[a-z][a-z0-9_]*(?::[^}]+)?|(?:[a-z][a-z0-9_]*\.)*[a-z][a-z0-9_]*\.\.(?:(?:[a-z][a-z0-9_]*\.)*[a-z][a-z0-9_]*)?|\.\.(?:[a-z][a-z0-9_]*\.)*[a-z][a-z0-9_]*|\.\.)\}/ig
//        ^^^^^^^^^^^^^^^^^^^^^^               ^^^^^^^^^   ^^^^^^^^^^^^^^^^^^^^^^                      ^^^^^^^^^^^^^^^^^^^^^^                      ^^^^^^^^^^^^^^^^^^^^^^
//        module/table name                    format      module/table name                           module/table name                           module/table name 
//        ------------------------------------------------ ----------------------------------------------------------------------------------- -----------------------------------------  -----
//            \{A.B}   or   \{A.B:FMT}                           \{A.B..}  or   \{A.B..C.D}                                                        \{..A.B}                               \{..}                 

// Given a string literal, identify if it contains any interpolation
// entries and tokenize them.
function tokenizeStringLiteral(
    tokens: IToken[], 
    state: State,
    line: string, 
    startIndex: number, 
    endIndex: number,
    isSchemaLiteral: boolean)
{
    const tok = isSchemaLiteral ? tok_schema : tok_string;
    while (startIndex < endIndex)
    {
        interpolationRegex.lastIndex = startIndex;
        const exec = interpolationRegex.exec(line);

        if (exec === null || interpolationRegex.lastIndex >= endIndex) 
        {
            // No (more) interpolations within the string, just paint it.
            tokens.push({ startIndex, scopes: tok })
            return;
        }

        const fullMatch = exec[0];

        // The match does not include the preceding \{ and following }
        const matchStart = interpolationRegex.lastIndex - fullMatch.length + 2;
        const matchEnd = interpolationRegex.lastIndex - 1;

        // Tokenize the string up to the \{ inclusive
        tokens.push({ startIndex, scopes: tok })
        
        // The match, excluding \{ and }
        const match = fullMatch.substring(2, fullMatch.length - 1);
        const byColon = match.split(':', 2);
        const byDotDot = byColon[0].split('..');
        const byDotAll = byDotDot.map(part => part.split('.'));

        let offset = matchStart;

        for (let j = 0; j < byDotAll.length; ++j)
        {
            const byDot = byDotAll[j];
            if (j > 0) {
                // The middle '..' 
                tokens.push({
                    startIndex: offset,
                    scopes: tok_operator
                });
                offset += 2;
            }

            // If any, the preceding 'Foo.' (possibly more than one, if 
            // modules are present)
            for (let i = 0; i < byDot.length - 1; ++i)
            {
                tokens.push({
                    startIndex: offset, 
                    scopes: regexMatch(state.moduleRegex, byDot[i], 0, byDot[i].length)
                        ? tok_module
                        : tok_table
                }, {
                    startIndex: offset + byDot[i].length,
                    scopes: tok_operator
                })

                offset += byDot[i].length + 1;
            }

            // The variable name (can be a dimension, too)
            tokens.push({
                startIndex: offset,
                scopes: regexMatch(state.dimRegex, 
                        byDot[byDot.length - 1], 
                        0, byDot[byDot.length - 1].length)
                    ? tok_dim : tok_identifier
            })

            offset += byDot[byDot.length - 1].length;
        }

        if (byColon.length > 1)
            tokens.push({ startIndex: offset, scopes: tok_operator}, 
                        { startIndex: offset + 1, scopes: tok_option });

        startIndex = matchEnd;
    }
}

function tokenize(line: string, state: IState): ILineTokens {

    let endState = state as State;

    // This tokenizer operates in two consecutive steps: 
    // 1. cut the line into tokens without any context beyond
    //    multi-line token detection (comments/markdown). This
    //    yields general token info like "keyword", "normal", etc.
    // 2. use the current grammatical context to re-interpret 
    //    the tokens from step 1 more precisely (type names, table
    //    names, dimensions, etc)

    // First step: cut into tokens
    // ===========================

    const tokens : IToken[] = [];

    // When inside a /* multi-line-comment */ or a """markdown""" 
    // token, remember when that token started _on the current line_
    // (zero if it was started on the previous line.)
    let currentBigTokenStart = 0;

    tokenRegex.lastIndex = 0;
    let startIndex = 0;
    while(startIndex < line.length) {

        if (typeof endState.midToken === "undefined")
        {
            // Normal token-matching. 

            tokenRegex.lastIndex = startIndex;
            tokenRegex.test(line);

            const len = tokenRegex.lastIndex - startIndex;
            const code = line.charCodeAt(startIndex);
            
            // Unknown identifier, or a keyword/subkeyword.
            // 'normal' is usually promoted to another kind (table, 
            // module, type, option, or even identifier) in the second
            // phase. 
            if (code >= 65 && code <= 90 || // A-Z
                code >= 97 && code <= 122)  // a-z
            {
                tokens.push({
                    startIndex,
                    scopes: isKeyword(line, startIndex) 
                        ? tok_keyword : 
                        isSubKeyword(line, startIndex) 
                        ? tok_subkeyword : tok_normal });
            }

            // Single-line comment or documentation
            else if (code == 47 && // '/'
                     len == 2 && 
                     line.charCodeAt(startIndex + 1) == 47) // '/'
            {
                const isDoc = line.length > startIndex + 2 && 
                            line.charCodeAt(startIndex + 2) == 47;
                            
                tokens.push({
                    startIndex,
                    scopes: isDoc ? tok_docs : tok_comment
                })

                if (isDoc && 
                    line.length > startIndex + 4 && 
                    line.charCodeAt(startIndex + 4) == 64)  // '@'
                {
                    // Special color for /// @foobar baz quux
                    //                       ^^^^^^^
                    //                      tok_doctag
                    tokens.push({
                        startIndex: startIndex + 4,
                        scopes: tok_doctag
                    });

                    for (let c = startIndex + 5; c < line.length; ++c) {
                        const ch = line.charCodeAt(c);
                        if (ch < 97 || ch > 122) { // [^a-z]
                            tokens.push({
                                startIndex: c,
                                scopes: tok_docs
                            });
                            break;
                        }
                    }
                }

                break; // The comment runs until the end of the line.
            }

            // Start of multi-line comment
            else if (code == 47 && // '/'
                     len == 2 && 
                     line.charCodeAt(startIndex + 1) == 42) // '*'
            {
                tokens.push({ startIndex, scopes: tok_comment });
                currentBigTokenStart = startIndex + 2;
                endState = { 
                    ...endState, 
                    prev: endState, 
                    midToken: "comment" }
            }

            // Start of markdown 
            else if (code == 34 && len == 3 && 
                     line.charCodeAt(startIndex + 1) == 34 && 
                     line.charCodeAt(startIndex + 2) == 34)
            {
                tokens.push({ startIndex, scopes: tok_markdown });
                currentBigTokenStart = startIndex + 3;
                endState = { 
                    ...endState, 
                    prev: endState,
                    midToken: "markdown" }  
            }

            // String literal, possibly containing interpolation.
            else if (code == 34 || // "
                     code == 39)   // '
            {
                tokenizeStringLiteral(
                    tokens, 
                    endState,
                    line, 
                    startIndex, 
                    tokenRegex.lastIndex,
                    code == 39);
            }

            // Number literal (or hex)
            else if (code >= 48 && code <= 57 || // 0-9
                     code == 35 && len > 1) 
            {
                tokens.push({ startIndex, scopes: tok_number })
            }

            // Anything not matched above can be an operator 
            // (this "mistakenly" includes `'&%$, but we don't care)
            else if (code >= 33 && code <= 126)
            {
                tokens.push({ startIndex, scopes: tok_operator })
            }
            
            else
            {
                tokens.push({
                    startIndex, 
                    scopes: tok_space });
            }

            startIndex = tokenRegex.lastIndex;
        }
        else if (endState.midToken == "comment")
        {
            // Currently inside a '/*' comment. 

            tokens.push({
                startIndex: currentBigTokenStart,
                scopes: tok_comment });
    
            endCommentRegex.lastIndex = startIndex;
                        
            if (!endCommentRegex.test(line))
                // Comment does not end on this line.
                break;

            startIndex = endCommentRegex.lastIndex;

            // Is this a nested comment or comment end ?
            const isNested = line.charAt(startIndex - 2) == "/";
            endState = isNested ? { ...endState, prev: endState } : endState.prev;
        }
        else if (endState.midToken == "markdown")
        {
            // Currently inside a """ markdown

            tokens.push({
                startIndex: currentBigTokenStart,
                scopes: tok_markdown });

            endMarkdownRegex.lastIndex = startIndex;

            if (!endMarkdownRegex.test(line))
                // Markdown does not end on this line
                break;

            startIndex = endMarkdownRegex.lastIndex;
            endState = endState.prev;
        }
    } 

    // Second step: refine identified tokens
    // =====================================

    const ctx = {
        state: endState,
        token: tokens[0],
        line,
        isEoL: false,
        end: 0
    }

    for (let i = 0; i < tokens.length; ++i) {
        const token = tokens[i];

        // Only a few tokens can be used by rules.
        if (token.scopes != tok_operator && 
            token.scopes != tok_keyword &&
            token.scopes != tok_subkeyword &&
            token.scopes != tok_normal &&
            token.scopes != tok_string && 
            token.scopes != tok_number) continue;

        ctx.token = token;
        ctx.end = i + 1 == tokens.length ? line.length : tokens[i+1].startIndex;
        
        if (!endState.action(ctx))
            act_fallback(ctx);
    }

    ctx.isEoL = true;
    while (endState.action(ctx));
    
    return { tokens, endState }
}

// A tokenizer, in the sense of a Monaco 'TokensProvider'
export const tokenizer = {
    getInitialState,
    tokenize
}