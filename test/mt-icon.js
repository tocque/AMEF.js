import utils from "./utils.js"

AMEF.register("mt-icon", {
    template: /* HTML */`
    <i class="codicon"></i>
    `,
    setup: function() {
        this.$prop = {
            "icon": String
        }
    },
    mounted: function() {
        console.log(utils.hello);
    }
})