/**
 * Another Mota-js Editor Framework
 * 为编辑器设计的MVVM框架
 * @author tocque
 */
import { _import, registerLoader } from "./module";
import { tagParser, textParser, expressionParser, ASTNode } from "./parser"

/**
 * 驼峰转连字符
 * @param {string} str 
 */
const camel2hyphenate = function(str: string) {
    str = str.replace(/[A-Z]/g, (e) => '-'+e.toLowerCase());
    if (str[0] == '-') return str.slice(1);
    return str;
}

/**
 * 绑定一个属性
 * @param {Element} elm 
 * @param {string} propName 
 * @param {string} val 
 * @param {ThisType<AMEFComponent>} self 
 */
const bindAttr = function(elm: Element, propName: string, val: string, self: ThisType<AMEFComponent>) {
    const { ref, experssion } = expressionParser(val);
    const calAttr = new Function(experssion).bind(self);
    const updateAttr = function() {
        elm.setAttribute(propName, calAttr());
    }
    Object.keys(ref).forEach((key) => {
        this.$watch(key, updateAttr);
    })
    updateAttr();
    elm.removeAttribute(":"+propName);
}

interface AMEFComponentConfig {
    setup?: () => void
    mounted?: () => void
    methods: { [key: string]: Function }
    name?: string
    template?: string
}

/**
 * AMEF组件的基类, 绝大多数框架功能在此处实现
 * - 内置函数和变量以$开头
 * - 内部实现用的各方法和变量以_开头
 */
class AMEFComponent {

    $data: { [key: string]: any; } = {}
    $prop: { [key: string]: any; } = {}
    $name: string = "base"
    /** 组件dom元素的根节点 */
    $root: Element
    $parent: AMEFComponent
    $children: AMEFComponent[] = []
    $template: string = ""
    $components: { [key: string]: AMEFComponentConfig } = {}
    $slots: { [key: string]: () => Element; } = {}

    _watcher: { [key: string]: Array<(value?: any, oldValue?: any) => void>; } = {}
    _listener: { [key: string]: Array<(payload?: any) => void>; } = {}

    /**
     * @param 
     */
    constructor(config: AMEFComponentConfig) {
        if (config.setup) {
            this._setup = config.setup.bind(this);
        }
        if (config.mounted) {
            this._mounted = config.mounted.bind(this);
        }
        if (config.name) {
            this.$name = config.name;
        }
        if (config.template) {
            this.$template = config.template;
        }
        if (config.methods) {
            Object.entries(config.methods).forEach(([name, func]) => {
                this[name] = func.bind(this);
            })
        }
        this._setup();
        console.log(this.$data);
        Object.keys(this.$data).forEach((key) => {
            this.$observe(key, true);
        })
    }

    /**
     * 生命周期钩子, 在组件实例化后运行
     */
    _setup() {

    }

    /**
     * 生命周期钩子, 在组件挂载后运行
     */
    _mounted() {

    }

    /**
     * 遍历深层数据对象
     * @param {string} key 监听对象名称
     * @param {any} obj 对象
     * @param {any} target
     * @private
     */
    _deepBind(key: string, obj: any, target: any) {

        if (typeof obj === 'object') { // 对对象进行深层遍历
            for (var k in obj) {
                this._deepBind(key, obj[k], obj);
            }
        } else {
            Object.defineProperty(target, key, {
                enumerable: true, // 是否可枚举
                configurable: true, // 是否可删除
                get: () => {
                    console.log('get', key, obj)
                    return obj;
                },
                set: (newVal) => {
                    console.log('set', key, newVal);
                    if (obj !== newVal) {
                        obj = newVal;
                        if (typeof newVal == 'object') this._deepBind(key, newVal, target);
                        this._watcher[key].forEach((e) => e(newVal, obj));
                    }
                }
            })
        }
    }

    /**
     * 监听一个属性
     * @param {string} key
     * @param {boolean} [init]
     */
    $observe(key: string, init?: boolean) {
        if (!init && this.$data[key]) return;
        if (this[key]) this.$data[key] = this[key];
        this._watcher[key] = [];
        this._deepBind(key, this.$data[key], this);
    }

    /**
     * 设置一个监听器
     * @param {string} propName 要监听的属性名
     * @param {(val?: any, oldVal?: any) => any} action 响应函数
     */
    $watch(propName: string, action: (val?: any, oldVal?: any) => any) {
        this._watcher[propName].push(action);
    }

    /**
     * 设置一个组件消息监听
     * @param {string} event 
     * @param {(payload?: any) => any} action 
     */
    $on(event: string, action: (payload?: any) => any) {
        if (!Array.isArray(this._listener[event])) this._listener[event] = [];
        this._listener[event].push(action);
    }

    /**
     * 向父组件发送一个消息
     * @param {string} event 
     * @param {any} payload 
     */
    $emit(event: string, payload?: any) {
        if (Array.isArray(this._listener[event])) {
            this._listener[event].forEach((e) => e(payload));
        }
    }

    /**
     * 对元素设置绑定
     * @param {Element} elm 
     * @param {ASTNode} tokens 
     */
    _attachEmitter_Element(elm: Element, tokens: ASTNode) {
        
        // 处理监听
        Object.entries(tokens.on).forEach(([key, val]) => {
            console.log(tokens.on);
            const { experssion } = expressionParser(val);
            const func = new Function(experssion).bind(this);
            elm.addEventListener(key, (e) => {
                func(e);
            })
            elm.removeAttribute(key);
        })
        // 处理绑定
        Object.entries(tokens.bind).forEach(([key, val]) => {
            bindAttr(elm, key, val, this);
        })
        // 处理双向绑定
        const models = Object.entries(tokens.model);
        if (models.length > 0) {
            if (!(elm instanceof HTMLInputElement)) {
                console.error("双向绑定指令只支持 <input/>" + "\nsource: " + elm.outerHTML);
            } else {
                models.forEach(([propName, event]) => {
                    if (!this[propName]) {
                        console.error("找不到双向绑定的目标属性 [" + propName + "] \nsource: " + elm.outerHTML);
                        return;
                    }
                    this.$watch(propName, (val) => {
                        elm.value = val;
                    })
                    elm.value = this[propName];
                    let needParse = (typeof this[propName] === "number");
                    elm.addEventListener(event || "input", (e) => { // 若没有给出event, 默认监听input
                        // @ts-ignore
                        this[propName] = needParse ? parseInt(e.target.value) : e.target.value;
                    })
                })
            }
        }
    }

    /**
     * 对组件设置绑定
     * @param {Element} elm 
     * @param {ASTNode} tokens 
     * @param {AMEFComponentConfig} proto 
     * @returns {AMEFComponent}
     */
    _attachEmitter_Component(elm: Element, tokens: ASTNode, proto: AMEFComponentConfig): AMEFComponent {
        const component = new AMEFComponent(proto);
        Object.entries(tokens.on).forEach(([key, val]) => {
            const { experssion } = expressionParser(val);
            const func = new Function(experssion).bind(this);
            component.$on(key, (e) => {
                func(e);
            })
            elm.removeAttribute(key);
        })
        return component;
    }

    /**
     * 对文本节点设置绑定
     * @param {ChildNode} elm 
     */
    _attachEmitter_textNode(elm: ChildNode) {
        console.log(elm.textContent);
        const textContent = textParser(elm.textContent);
        console.log(textContent);
        if (textContent.length === 1 && textContent[0][0] === 0) return;
        const refs = {};
        const renderTokens: (string|(() => void))[] = [];
        for (let token of textContent) {
            if (token[0] == 1) {
                const { ref, experssion } = expressionParser(token[1]);
                renderTokens.push((new Function("return (" + experssion + ")")).bind(this));
                Object.assign(refs, ref);
            } else {
                renderTokens.push(token[1]);
            }
        }
        const updateText = function() {
            elm.textContent = renderTokens.map((token) => {
                if (token instanceof Function) return token();
                else return token;
            }).join("");
            // @ts-ignore
            window.dbg = renderTokens;
        };
        Object.keys(refs).forEach((key) => {
            this.$watch(key, updateText);
        })
        updateText();
    }

    /**
     * 递归解析模板并设置绑定器
     * @param {ChildNode} elm
     * @param {Element} [parent] 
     */
    _attachEmitter(elm: ChildNode, parent?: Element) {
        if (elm instanceof Element) {
            // @ts-ignore
            const tagHTML = elm.cloneNode().outerHTML;
            const tagContent = tagParser(tagHTML);
            console.log(tagContent);
            const tagName = tagContent.tagName;
            const isComponent = tagName.includes("-");
            if (isComponent) { // 有连字符则判断为组件
                const component = this.$components[tagName] || AMEF._global[tagName];
                if (!component) {
                    throw Error(`未注册的组件: <${tagName}></${tagName}>`);
                }
                const childComponent = this._attachEmitter_Component(elm, tagContent, component);
                // 组件的innerHTML作为插槽模板使用
                childComponent.$slots.default = () => {
                    return this.$render(elm.innerHTML);
                }
                childComponent.$mount(elm, this);
            } else {
                this._attachEmitter_Element(elm, tagContent);
                elm.childNodes.forEach((e) => this._attachEmitter(e, elm));
            }
        } else if (elm) {
            this._attachEmitter_textNode(elm);
        }
    }

    /**
     * 将模板渲染成DOM
     * @param {string} tpl 
     * @returns {Element}
     */
    $render(tpl: string): Element {
        const fac = document.createElement("div");
        fac.innerHTML = tpl;
        if (!fac.firstElementChild) {
            const name = this.$name;
            throw Error(`模板必须有一个根节点, 错误来源: <${name}></${name}>`);
        }
        this._attachEmitter(fac.firstElementChild);
        return fac.firstElementChild;
    }

    /**
     * 将组件挂载到父组件或dom元素上
     * @param {string|Element} to 要挂载到的DOM对象
     * @param {AMEFComponent} [parent]
     */
    $mount(to: string | Element, parent: AMEFComponent) {
        if (typeof to ===  "string") {
            to = document.querySelector(to);
            if (!to) {
                throw Error("mount to enmty");
            }
        }
        if (parent) {
            parent.$children.push(this);
            this.$parent = parent;
        }
        this.$root = this.$render(this.$template);
        to.replaceWith(this.$root);
        this._mounted();
        return this;
    }
}

const AMEF = new class {
    Component = AMEFComponent
    import = _import
    registerLoader = registerLoader
    _global: { [key: string]: AMEFComponentConfig } = {};
    __temp__ = {};

    /**
     * 注册一个全局组件
     * @param {AMEFComponentConfig} component 
     * @param {string} [name] 组件名称 
     */
    register(name: string, component: AMEFComponentConfig) {
        component.name = name;
        // name = name || camel2hyphenate(component.name);
        if (!name) {
            console.error("请提供组件名称, 错误组件: " + component);
            return;
        } else if (name in this._global) {
            console.error(`已经注册了同名组件, 错误组件: <${name}></${name}>`);
            return;
        } else if (!name.includes("-")) {
            console.error(`组件名称必须包含连字符, 错误组件: <${name}></${name}>`);
            return;
        }
        this._global[name] = component;
    }

    /**
     * 实例化一个组件
     * @param {string} name 组件名称 
     * @returns {AMEFComponent}
     */
    instance(name: string): AMEFComponent {
        return new AMEFComponent(this._global[name]);
    }
}

// @ts-ignore
window.AMEF = AMEF;
