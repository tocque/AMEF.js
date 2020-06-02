/**
 * @file parser.ts 词法解析器存放在此处
 */


/**
 * 
 * @param {string} str 
 * @param {string} info 
 */
const parseError = function(str: string, info: string) {
    throw Error("不正确的模板字符串: \n" + str + info);
}

const attrDict = {
    '@': "on",
    ':': "bind",
    '&': "model",
    '$': "order",
}

export interface ASTNode {
    tagName: string
    attrs: { [key: string]: string } 
    on: { [key: string]: string } 
    bind: { [key: string]: string } 
    model: { [key: string]: string } 
    order: { [key: string]: string } 
}

/**
 * 从标签内容中解析出各个属性
 * @param {string} tpl 
 * @returns {ASTNode}
 */
export const tagParser = function(tpl: string): ASTNode {
    console.log(tpl);
    const tagName = tpl.split(/[ >]/, 1)[0].slice(1);
    // 若有闭标签则去掉, 得到完整的模板
    if (tpl.endsWith(tagName+'>')) {
        tpl = tpl.slice(tagName.length+1, -tagName.length-3);
    } else {
        tpl = tpl.slice(tagName.length+1);
    }
    let state = 0, 
        attrStart = -1, attrName = "", 
        valueStart = -1, quotationMark = "";
    const tokenPool = {
        attrs: {},
        on: {},
        bind: {},
        model: {},
        order: {},
    }
    /** @param {string} val */
    const push = function(val) {
        attrStart = -1;
        if (attrName[0] in attrDict) {
            tokenPool[attrDict[attrName[0]]][attrName.slice(1)] = val;
        } else {
            tokenPool.attrs[attrName] = val;
        }
        attrName = "";
    }
    for (let i = 0; i < tpl.length; i++) {
        const ch = tpl[i];
        switch(state) {
            case 0: { // 未进入匹配
                if (/[a-zA-Z#$@&]/.test(ch)) { // 进入属性匹配
                    if (attrStart > 0) { // 若上一个属性未赋值, 则赋为空字符串
                        push("");
                    }
                    attrStart = i;
                    state = 1;
                } else if (ch === '=') { // 进入值匹配
                    if (attrStart == -1) {
                        parseError(tpl.substring(0, i+1), " <=== 在此处匹配到了没有对应属性的赋值符号");
                    }
                    state = 2;
                } else if (ch === '>') { // 遇到 > 返回
                    if (attrStart > 0) { // 若上一个属性未赋值, 则赋为空字符串
                        push("");
                    }
                    return { tagName, ...tokenPool  };
                }
            } break;
            case 1: { // 匹配属性名称
                if (/[\s>=]/.test(ch)) { // 遇到空字符或>或=时退出匹配
                    attrName = tpl.substring(attrStart, i);
                    state = 0;
                    if (ch === '>' || ch === '=') i--; // 重匹配
                }
            } break;
            case 2: { // 尝试匹配值
                if (/['"]/.test(ch)) { // 遇到引号时进入值匹配
                    quotationMark = ch;
                    valueStart = i+1;
                    state = 3;
                } else if (/[>=]/.test(ch)) {
                    parseError(tpl.substring(0, i+1), " <=== 在此处匹配到了没有对应值的赋值符号");
                }
            } break;
            case 3: { // 匹配值
                if (ch == quotationMark) { // 遇到成对引号时匹配终止
                    push(tpl.substring(valueStart, i));
                    state = 0;
                }
            } break;
        }
    }
    parseError(tpl, "\n 没有正确终止");
}

/**
 * 文本节点匹配
 * @param {string} tpl 
 * @returns {[number, string][]}
 */
export const textParser = function(tpl: string): [number, string][] {
    const token: [number, string][] = [];
    let state = 0, 
        textStart = 0,
        experssionStart = 0;
    for (let i = 0; i < tpl.length; i++) {
        const ch = tpl[i];
        switch(state) {
            case 0: { // 匹配文本节点
                if (ch === "{" && tpl[i+1] === "{") { // 匹配到mustache语法
                    token.push([0, tpl.substring(textStart, i)]);
                    experssionStart = i+2;
                    i++;
                    state = 1;
                }
            } break;
            case 1: {
                if (ch === "}" && tpl[i+1] === "}") { // 匹配到mustache语法
                    token.push([1, tpl.substring(experssionStart, i)]);
                    textStart = i+2;
                    i++;
                    state = 0;
                }
            }
        }
    }
    if (state === 1) {
        parseError(tpl, "\n mustache值块没有正确终止 ");
    }
    return token;
}

/**
 * 表达式解析, 分析表达式中引用的组件变量, 并添加this指向
 * @param {string} tpl
 * @returns {{ ref: {[key: string]: string}, experssion: string }}
 */
export const expressionParser = function(tpl: string): { ref: { [key: string]: string; }; experssion: string; } {
    const ref = {};
    let state = 0;
    let varLast = 0;
    let quotationMark: string;
    const tokens = [];
    for (let i = 0; i < tpl.length; i++) {
        const ch = tpl[i];
        switch(state) {
            case 0: { // 正常匹配
                if (ch === '@') { // 匹配到变量
                    tokens.push(tpl.slice(varLast, i));
                    varLast = i+1;
                    // state = 2;
                } else if (/"'`/.test(ch)) { // 是字符串
                    quotationMark = ch;
                    state = 1;
                }
            } break;
            case 1: { // 引号分析
                if (quotationMark == ch) { // 匹配到字符串结尾
                    state = 0;
                }
            } break;
            // case 2: { // 匹配变量
            //     if (!/[\w$]/.test(ch)) { // 变量结束
            //         state = 0;
            //     }
            // } break;
        }
    }
    tokens.push(tpl.slice(varLast, tpl.length));
    return { ref, experssion: tokens.join("this.") };
}
