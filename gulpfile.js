const { src, dest, task } = require('gulp');
const fs = require('fs');
const rollup = require('rollup');
const tsLoader = require("rollup-plugin-typescript2");

/**
 * AMEF单文件组件编译
 * @param {string} src
 * @param {string} dest
 */
const AMEFSFCCompile = async function(src) {
    return new Promise((res) => {
        fs.readFile(src, "utf-8", (err, data) => {
            let script, style;
            data = data.replace(/<script>([^]*)<\/script>/, (all, text) => {
                script = text;
                return "";
            })
            if (!script) throw Error("编译模板失败: " + src + " 没有<script>"); 
            data = data.replace(/<style>([^]*)<\/style>/, (all, text) => {
                style = text;
                return "";
            })
            data = `\n$template = /* HTML */\`${data.trim().slice(10, -11)}\`;\n`;
            script = `AMEF.register(${script.replace(/extends\s+AMEF\.Component\s+{/, (text) => {
                return text + data;
            })});`;
            res({ script, style });
        });
    })
}

task('test', async() => {
    const { script, style } = await AMEFSFCCompile("test/SFCtest.html");
    fs.writeFile("_server/test/sfc.js", script, "utf-8", () => {});
    fs.writeFile("_server/test/sfc.css", style, "utf-8", () => {});
})

task('release', async() => {
    await rollup.rollup({
        input: 'src/AMEF.ts',
        plugins: [
            tsLoader()
        ],
        output: {
            file: 'dist/AMEF.js',
            format: 'iife'
        }
    });
})