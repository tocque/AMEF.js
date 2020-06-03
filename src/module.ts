/**
 * 模块化系统的支持类
 */

import { transpiler } from "./transpiler";

class Module {
    hook: Promise<any> // 加载状态
    _content: any // 模块内容
    constructor(hook: Promise<any>) {
        this.hook = hook;
    }
    get content() {
        return this._content;
    }
    set content(val) {
        throw Error("模块导出内容不可修改");
    }
}

/**
 * 缓存曾经读取过的模块
 */
const cache: {[key: string]: Module} = {}

/**
 * 解析路径
 * @param {string} now 
 * @returns {string}
 */
const resolvePath = function(now: string, ...paths: string[]): string {
    const tokens = now.split('/');
    while(tokens[0] === '.') tokens.shift();
    tokens.pop(); // 去掉自身文件名
    for (let path of paths) {
        const _tokens = path.split('/');
        for (let _token of _tokens) {
            if (_token === '.') continue;
            else if (_token === '..') {
                if (tokens.length === 0 || tokens[tokens.length-1] === '..') {
                    tokens.push();
                }
                tokens.pop();
            } else tokens.push(_token);
        }
    }
    return tokens.join('/');
}

const importCSS = async function(url: string) {
    const css = document.createElement('link');
    css.rel = "stylesheet";
    css.type = "text/css";
    if (cache[url]) {
        return cache[url].hook;
    }
    return new Promise((res) => {
        css.href = url;
        document.head.appendChild(css);
        cache[url]._content = css;
        css.onload = (e) => res();
    })
}

const processJS = async function(rawscript: string, url: string) {
    const headstrs = [];
    AMEF.__module__[url] = {};
    const { imports, exports, script } = transpiler(rawscript);
    const deps = Object.entries(imports||{}).map(([path, dep]) => {
        if (Array.isArray(dep)) { // 有导出模块
            const uri = resolvePath(url, path);
            dep.forEach((e) => {
                if (Array.isArray(e)) {
                    if (e[0] === "*") { // 导出全部
                        headstrs.push(`var ${e[1]} = AMEF.__module__["${uri}"];`);
                    } else {
                        headstrs.push(`var ${e[1]} = AMEF.__module__["${uri}"]["${e[0]}"];`);
                    }
                } else {
                    headstrs.push(`var ${e} = AMEF.__module__["${uri}"]["${e}"];`);
                }
            })
        }
        return _import(path, url);
    });
    await Promise.all(deps);
    const elm = document.createElement("script");
    elm.innerHTML = /* js */`"use strict";
/** @file ${ url } */
(function(exports) {
${ headstrs.join('\n') } 
${ script }
${ exports ? exports.map(e => `exports.${e} = ${e};`).join('\n') : "" }
})(AMEF.__module__["${ url }"])
    `;
    console.log(elm.innerHTML);
    document.body.appendChild(elm);
    cache[url]._content = AMEF.__module__[url];
}

const importJS = async function(url: string) {
    return fetch(url)
        .then((e) => e.text())
        .then(async(script) => {
            await processJS(script, url);
            return cache[url].content;
        })
}

const importSFC = async function(url: string) {
    return fetch(url)
        .then((e) => e.text())
        .then(async(sfc) => {
            const sandbox = document.createElement("template");
            sandbox.innerHTML = sfc;
            const script = sandbox.content.querySelector("script").innerHTML;
            const template = sandbox.content.querySelector("template").innerHTML;
            const styles = sandbox.content.querySelectorAll("style");
            await processJS(script, url);
            styles.forEach((e) => document.body.appendChild(e));
            if (template && cache[url].content.default) {
                cache[url]._content.default.template = template;
            }
            return cache[url].content;
        })
}

const loaders: { [key: string]: (path: string) => Promise<any> } = {
    "css": importCSS,
    "js": importJS, 
    "html": importSFC,
}

/**
 * 注册一个loader
 * @param suffix 
 * @param loader 
 */
export const registerLoader = function(suffix: string, loader: (path: string) => Promise<any>) {
    if (suffix in loaders) {
        console.error("注册"+suffix+"loader失败, 已经有一个loader了");
    } else {
        loaders[suffix] = loader;
    }
}

/**
 * @param {string} path 要引入模块的路径
 * @param {string} now 当前模块的路径
 */
export const _import = async function(path: string, now: string = "."): Promise<any> {
    const suffix = path.split(".").slice(-1)[0];
    path = resolvePath(now, path);
    console.log(suffix, path, now);
    if (!(suffix in loaders)) {
        throw Error(`在引入 ${path} 时发生错误: 没有对应的加载方法`);
    }
    if (!(path in cache)) {
        cache[path] = new Module(loaders[suffix](path));
    }
    return cache[path].hook;
}