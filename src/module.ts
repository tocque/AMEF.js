/**
 * 模块化系统的支持类
 */

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

/**
 * export的工厂函数, 返回一个export函数供模块使用
 * @param {string} path
 * @returns {(obj: any) => void}
 */
const _export = function(path: string): (obj: any) => void {
    return (m) => {
        if (cache[path].content) {
            throw Error(`在导入${path}时出现了错误: 模块进行了多次导出`);
        }
        cache[path]._content = m;
    }
}

const depReg = /\/\/\/ *<amd-dependency +path=["']([\w\.\/-]+)["']( +name=["']([\w$]+)["'])? *\/>/g;

const processJS = async function(script: string, url: string) {
    let res: RegExpExecArray;
    const deps = [];
    const headstrs = [];
    console.log(script);
    // @ts-ignore
    AMEF.__temp__[url] = {};
    while(res = depReg.exec(script)) {
        const path = res[1], name = res[3];
        deps.push(_import(path, url).then((m) => {
            console.log(path, name);
            if (name) {
                headstrs.push(`var ${name} = AMEF.__temp__["${url}"]["${path}"]\n`);
                // @ts-ignore
                AMEF.__temp__[url][path] = m;
            }
        }));
    }
    await Promise.all(deps);
    // @ts-ignore
    AMEF.__temp__[url]["@exports"] = _export(url);
    const elm = document.createElement("script");
    console.log(headstrs);
    script = /* js */`(function(exports) {
        /** @file ${ url } */
        ${ headstrs.join('\n') } 
        ${ script }
    })(AMEF.__temp__["${ url }"]["@exports"])`;
    elm.innerHTML = script;
    document.body.appendChild(elm);
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
            const deps = sandbox.content.querySelectorAll("amd-dependency");
            const depOrders = [];
            deps.forEach((e) => {
                const path = e.getAttribute('path');
                const name = e.getAttribute('name');
                depOrders.push(`/// <amd-dependency path="${path}" ${name? 'name="' + path + "'": ""}/>`);
            });
            const styles = sandbox.content.querySelectorAll("style");
            await processJS(depOrders.join('\n') + script, url);
            styles.forEach((e) => document.body.appendChild(e));
            cache[url]._content.template = template;
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
export const _import = async function(path: string, now = "."): Promise<any> {
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