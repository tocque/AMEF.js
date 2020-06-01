# 关于AMEF.js

AMEF.js是一个半MVVM的前端开发框架, AMEF.js使用组件化开发和模板语法, 但是不提供虚拟dom, 这意味着AMEF不会隐式的改变dom结构

AMEF 是 Another Mota-js Editor Framework 的缩写, 本框架的设计面向[mota-js 2.x](https://github.com/ckcz123/mota-js)的需求, 所有功能均可以在不使用任何预处理工具, 如babel, 的情况下在es5的浏览器环境运行, 因此开发者和他们的用户将面对同一份代码, 这对于鼓励用户对工程进行修改的项目而言非常有意义

AMEF的组件化形式和模板非常类似vue, 如果你用过vue, 那么只需要五分钟就能掌握全部语法

## 组件声明

```js
const vm = new AMEF.Component({
    template: /* HTML */`
    <div :class="'unit '+ @goods" @keyup.ctrl.up="@money += 2">
        <input type="text" &money/>
        <span @click.stop="console.log('ok')" $show="true"  ref="out">商店的价格是: {{ @money }}</span>
        下一次是 {{ @money + 2 }} 元
        <mt-side icon="close" @switch="@get"></mt-side>
    </div>
    `, // 组件的html模板
    setup: function() {
        this.$data = {
            money: 10
        }
        this.$prop = {
            goods: String
        }
    },
    mounted: function() {
        utils.hello();
    },
    methods: {
        mutil: function() {   
            this.$refs.out.appendChild(this.$render(/* HTML */`
                <span>{{ @goods }}</span>
            `))
        }
    }
});
vm.$mount("#target");
```

一个典型的AMEF组件是通过向AMEF.Component构造器传入一个配置对象生成的, 使用$mount语法将组件挂载到dom树上, 即可正常显示

## 模板语法

```html
<div :class="'unit '+ @goods" @keyup.ctrl.up="@money += 2">
    <input type="text" &money/>
    <span @click.stop="console.log('ok')" $show="true"  ref="out">商店的价格是: {{ @money }}</span>
    下一次是 {{ @money + 2 }} 元
    <mt-side icon="close" @switch="@get"></mt-side>
</div>
```

这段模板展示了AMEF的几乎所有语法:

### 属性绑定

你可以使用 :attr 语法将一个属性和一个表达式相关联, 框架会尝试监听这个表达式里所有的data或prop(以@开头), 当它们的值发生变化时, 会用表达式为属性赋值

### 事件监听

你可以使用 @event 语法监听一个事件, 相比于原生的onevent语法, @event支持一些额外的修饰符, 譬如可以用.stop停止事件传播, 对于键盘事件, 可以使用.ctrl .shirt .alt 以及 .up 这类键盘映射来指定要响应的按键

    支持的键盘映射包括 f1~f12, a~z, 0~9, 方向键, space

特别的, 当事件监听语法写在一个[组件](#组件)上时, 代表监听子组件发出的消息, 对应的, 子组件可以使用$emit语法向父组件发送一个消息, 这个消息允许至多一个参数

### 双向绑定

你可以使用 &model 语法将一个input和一个data进行绑定, 这样, 当你给data赋值时, 对应input的值也会相对变化
这相当于一个 @input="@model = $event.value" :value = "@model" 的语法糖

特别的, 对于 checkbox, 会监听其checked属性而不是value

### 自定义指令

也许你想自己设定一个指令, 这种情况下, $order 语法就可以发挥作用了, 可以通过 AMEF.addOrder语法设定一个指令, 当解析到某个指令时, 会调用对应的函数, 并传入 元素 以及 属性的值 和 表达式解析器 三项属性, 例如对于上面这个实例, 其内部会调用

```js
const show = function(elm, val, parser) {
    const { ref, expression } = parser(val);
    const updateFunc = new Function("return "+expression).bind(this);
    this.$watch(ref, () => { // 当执行指令时, this指向调用渲染的组件
        show.style.display = updateFunc();
    })
}
```

# 功能集成

除了dom操作, AMEF还有一套集成的工具, 同样的, 这套工具可以在es5下运行

## 模块化

AMEF提供了一套简易的模块化工具, 支持通过路径引入各种模块

可以通过AMEF.import函数动态加载一个文件, 这个函数将返回一个Promise, 如果对应的文件有导出模块, 在Promise中会传回这个导出模块, 对于js文件以及SFC, 可以使用exports函数进行导出

内置的文件支持包括 .html/.vue(针对SFC) .css .js
AMEF提供了一个预处理接口, 因此用户可以针对载入的文件做一些预处理操作

预处理的一个实际使用就是静态import语法, 这是通过字符串解析完成的

AMEF的import通过ts的三斜线指令实现, 这个三斜线指令被强制要求写在文件顶部, import的模块被命名为name属性设定的值
```js
/// <amd-dependency path="./utils.js" name="utils"/>
```
在导入模块时, 预处理器会分析文本, 按照三斜线指令生成实际的导入语句

## 单文件组件(SFC)

AMEF支持单文件组件, 这听上去很离奇, 因为AMEF宣称自己不使用预处理工具, 实际上, 这是通过一些trick式的运行时分析完成的

上面的组件改写为SFC的形式大致如下

```html
<template>
    <div :class="'unit '+ @goods" @keyup.ctrl.up="@money += 2">
        <input type="text" &money/>
        <span @click.stop="console.log('ok')" $show="true"  ref="out">商店的价格是: {{ @money }}</span>
        下一次是 {{ @money + 2 }} 元
        <mt-side icon="close" @switch="@get"></mt-side>
    </div>
</template>
<amd-dependency path="./utils.js" name="utils"/>
<script>
    exports({
        setup: function() {
            this.$data = {
                money: 10
            }
            this.$prop = {
                goods: String
            }
        },
        mounted: function() {
            utils.hello();
        },
        methods: {
            mutil: function() {   
                this.$refs.out.appendChild(this.$render(/* HTML */`
                    <span>{{ @goods }}</span>
                `))
            }
        }
    });
</script>
<style>
    .unit {
        width: 100px;
    }
</style>
```

SFC允许你声明多个style块, 或者一些其他的自定义块, 并对其进行一定的预处理, 譬如, 在SFC中可以直接把import语法写在脚本块外部

SFC内置支持的后缀名包括.html和.vue, 不过, vue社区提供的高亮支持与AMEF并不是完全匹配的, 可能需要一些微调

## polyfill

尽管AMEF摆脱了babel, 但是polyfill仍然是必不可少的, AMEF依赖Promise和fetch, 以及Object.assign

## 已知存在的bug

- 模块系统尚未解决循环引用问题
- 模板语法的表达式解析十分粗糙, 因而会替换字符串中以@开头的词