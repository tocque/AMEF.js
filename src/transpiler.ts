/**
 * @file 实现monarch的类
 */
type token  = [string, string, token?, token?, string?]

const keywords = [
    'from', 'yield', 'async', 'await'
]
const reserves = [ // 区分是是否可被声明为变量
    'class', 'const', 'debugger', 'delete',
    'extends', 'false', 'function', 'in', 'instanceof', 'interface',
    'let', 'new', 'null', 'super', 'this', 'true', 'typeof', 'var',
    'void', 'with', 'of',
    'as', 'break', 'case', 'catch', 'continue', 'default', 'do', 'else',
    'export', 'for', 'if', 'import', 'return',
    'switch', 'throw', 'try', 'while', 'with'
]
// const systemClass = [
//     'Array', 'Boolean', 'console', 'Date', 'Error','Function', 'JSON', 'Math',
//     'Number', 'Object', 'Promise', 'Proxy', 'Reflect', 'RegExp', 'String', 
// ]

const operators = [
    '<=', '>=', '==', '!=', '===', '!==', '=>', '+', '-', '**',
    '*', '/', '%', '++', '--', '<<', '</', '>>', '>>>', '&',
    '|', '^', '!', '~', '&&', '||', '??', '?', ':', '=', '+=', '-=',
    '*=', '**=', '/=', '%=', '<<=', '>>=', '>>>=', '&=', '|=',
    '^=', '@', '?.', '??=', '||=', '&&=',
]

const tokenreg: { [key: string]: RegExp } = {
    variable: /[a-zA-Z_$][\w$]*/g,
    whitespace: /[ \t\r\n]+/g,
    comment: /\/\/.*$/mg,
    regexp: /\/([^\\\/]|\\.)+\/[gimsuy]*\s*(\.|;|,|\)|\]|\}|$)/mg,
    symbol: /[=><!~?:&|+\-*\/\^%]+/g,
    float: /\d+(_+\d+)*[eE]([\-+]?\d+(_+\d+)*)?/g,
    _float: /\d+(_+\d+)*\.\d+(_+\d+)*([eE][\-+]?\d+(_+\d+)*)?/g,
    hex: /0[xX][[0-9a-fA-F]+(_+[0-9a-fA-F]+)*n?/g,
    octal: /0[oO]?[[0-7]+(_+[0-7]+)*n?/g,
    binary: /0[bB][[01]+(_+[01]+)*n?/g,
    digit: /\d+(_+\d+)*n?/g,
}

/**
 * JS tokenizer, 不具备报错能力
 * @example
 * import utils from "./utils.js"
 * function setup(props) {
 *     const a = ref(0)
 * }
 * => 
 * [
 *     [ "keyword", "import" ],
 *     [ "identifier", "utils" ],
 *     [ "keyword", "from" ],
 *     [ "string", '"./utils.js"' ],
 *     [ "function", "from" ],
 *     [ "identifier", "setup" ],
 *     [ "bracket", "(" ],
 *     [ "identifier", "props" ],
 *     [ "bracket", ")" ],
 *     [ "delimiter.bracket", "{" ],
 *     [ "keyword", "const" ],
 *     [ "identifier", "a" ],
 *     [ "operator", "=" ],
 *     [ "identifier", "ref" ],
 *     [ "bracket", "(" ],
 *     [ "number", "0" ],
 *     [ "bracket", ")" ],
 *     [ "delimiter.bracket", "}" ],
 * ]
 * @param {string} script
 * @returns {token[]}
 */
export const tokenizer = function (script: string): token[] {
    console.log(script);
    console.time();
    const tokens = [];
    let i = 0; // 当前字符下标
    let state = 0;
    let inTemplateString = false;
    let bracketCounting = -1; // 括号计数器, 若启用时
    let templateStringStart = -1;
    let tryMatch: RegExpExecArray;
    let lastNoEmptyToken: token = ['', ''];
    const push = function(token: token) {
        if (token[0] != '' && token[0] != 'comment' && token[0] != 'comment.doc') {
            token[2] = lastNoEmptyToken;
            lastNoEmptyToken[3] = token;
            lastNoEmptyToken = token;
        }
        tokens.push(token);
    }
    const match = function(name: string, index = i): RegExpExecArray { // 匹配
        tokenreg[name].lastIndex = index;
        const res = tokenreg[name].exec(script);
        if (tokenreg[name].lastIndex && i === tokenreg[name].lastIndex - res[0].length) { // 判断是粘滞
            i = tokenreg[name].lastIndex - 1;
            return res;
        }
        return null;
    }
    for (; i < script.length; i++) {
        const ch = script[i];
        switch(state) {
            case 0: { // 正常匹配
                if (ch === "{") {
                    if (inTemplateString) {
                        bracketCounting++;
                    }
                    push(["bracket", ch]);
                } else if (ch === "}") {
                    if (inTemplateString) {
                        bracketCounting--;
                        if (!bracketCounting) {
                            templateStringStart = i+1;
                            state = 2;
                        }
                    }
                    push(["bracket", ch]);
                } else if (/[a-zA-Z_$]/.test(ch)) { // 匹配变量
                    push(["identifier", match("variable")[0]]);
                } else if (/[ \t\r\n]/.test(ch)) {
                    push(["", match("whitespace")[0]]);
                } else if (ch === '/' && script[i+1] === '*') {
                    if (script[i+2] == '*' && script[i+3] != '/') {
                        push(["comment.doc", "/**"]);
                        i += 2;
                        state = 1;
                    } else {
                        const close = script.indexOf("*/", i+1);
                        push(["comment", script.slice(i, close+2)]);
                        i = close + 1;
                    }
                } else if (ch === '/' && script[i+1] === '/') {
                    push(["", match("comment")[0]]);
                } else if (ch === '/' && (tryMatch = match("regexp"))) {
                    push(["regexp", tryMatch[0]]);
                } else if (/[()\[\]]/.test(ch)) { // delimiters and operators
                    push(["bracket", ch]);
                } else if (/!(?=([^=]|$))/.test(ch)) {
                    push(["delimiter", ch]);
                } else if (/[=><!~?:&|+\-*\/\^%]/.test(ch)) {
                    const symbol = match("symbol")[0];
                    if (symbol === "=>") {
                        push(["keyword", symbol]);
                    } else if (operators.includes(symbol)) {
                        push(["delimiter", symbol]);
                    }
                } else if (/\d/.test(ch)) { // numbers
                    if (ch === '0') {
                        if (script[i+1] === 'x' || script[i+1] === 'X') {
                            push(["number.hex", match("hex")[0]]);
                            break;
                        } else if (/[oO0-7]/.test(script[i+1])) {
                            push(["number.octal", match("octal")[0]]);
                            break;
                        } else if (script[i+1] === 'b' || script[i+1] === 'B') {
                            push(["number.binary", match("binary")[0]]);
                            break;
                        }
                    }
                    tryMatch = match("float") || match("_float") || match("digit");
                    push(["number", tryMatch[0]]);
                } else if (/[;,.]/.test(ch)) {
                    push(["delimiter", ch]);
                } else if (ch === '"' || ch === "'") { // 字符串
                    const next = script.indexOf(ch, i+1);
                    push(["string", script.slice(i, next+1)]);
                    i = next;
                } else if (ch === "`") { // 模板字符串分析
                    templateStringStart = i;
                    state = 2;
                }
            } break;
            case 1: { // 匹配jsdoc 暂时不分析注解
                if (ch === '*' && script[i+1] === '/') {
                    push(["comment.doc", "*/"]);
                    i++;
                    state = 0;
                }
            } break;
            case 2: { // 匹配模板字符串
                if (ch === '$' && script[i+1] === '{') {
                    bracketCounting = 1;
                    push(["string.template", script.slice(templateStringStart, i)]);
                    push(["keyword", "${"]);
                    i++;
                    state = 0;
                } else if (ch === '`') {
                    push(["string.template", script.slice(templateStringStart, i+1)]);
                    state = 0;
                }
            } break;
        }
    }
    console.timeEnd();
    return tokens;
}

export const parser = function(tokens: token[]): token[] {
    for (let token of tokens) {
        if (token[0] === "identifier"
            && reserves.includes(token[1]) 
            && token[2][1] != '.' && token[3]?.[1] != ':') {
            token[0] = "keyword";
        }
    }
    return tokens;
}

interface transProduct {
    script: string, 
    imports?: { [key: string]: boolean | [] }, 
    exports?: []
}

/**
 * 转译器
 * @param {string} script 
 * @returns
 */
export const transpiler = function(script: string): transProduct {
    const rawtokens = parser(tokenizer(script));
    const tokens: string[] = [];
    const output: any = {};
    for (let i = 0; i < rawtokens.length; i++) {
        const rawtoken = rawtokens[i];
        if (rawtoken[0] === "keyword") {
            if (rawtoken[1] === "const" || rawtoken[1] === "let") {
                rawtoken[1] = "var";
            } else if (rawtoken[1] === "export") {
                if (!output.exports) output.exports = [];
                if (rawtoken[3][1] === "default") { // export default => exports.default = 
                    rawtoken[4] = "";
                    rawtoken[3][4] = "exports.default =";
                } else { // export declare xxx 在 export 里添加后 由模块工具追加 "exports.xxx = xxx"
                    output.exports.push( rawtoken[3][3][1] );
                    rawtoken[4] = "/* export */";
                }
            } else if (rawtoken[1] === "import") {
                if (!output.imports) output.imports = {};
                let now = rawtoken[3];
                rawtoken[4] = "/* import";
                const next = function(step = 1) {
                    while(step--) now = now[3];
                }
                if (now[0] === "string") { // import xxx 直接在imports里添加
                    output.imports[now[1].slice(1, -1)] = true;
                } else { // import yyy, { xxx } from xxx 的形式 在imports里添加后由 模块工具追加 var xxx = AMEF.__module__[yy][xxx];   
                    const imports: any = []; // 若为重命名导出 则push一个二元组
                    if (now[0] === "identifier") { // 注意到 default 导出只能位于普通导出之前
                        imports.push(["default", now[1]]);
                        if (now[3][1] === ",") next(2); // 若为, 则存在解构导出
                    }
                    if (now[1] === "*") { // * as xxx 形式
                        console.log(now);
                        next(2);
                        imports.push(["*", now[1]]);
                    } else if (now[1] === "{") { // 进入解构导出
                        next();
                        // @ts-ignore
                        while(now[1] !== "}") { // 不支持解构语法, 故只有一层
                            if (now[3][1] === "as") { // as 重命名形式
                                imports.push([now[1], now[3][3][1]]);
                                next(3);
                            } else {
                                imports.push(now[1]);
                            }
                            next();
                            // @ts-ignore
                            if (now[1] === ",") next();
                        }
                    }
                    next(2); // 跳过from
                    output.imports[now[1].slice(1, -1)] = imports;
                }
                if (now[3]?.[1] === ";") {
                    next();
                }
                now[1] += " */\n"
            }
        }
        tokens.push(rawtoken[4] ?? rawtoken[1]);
    }
    output.script = tokens.join('');
    return output;
}
