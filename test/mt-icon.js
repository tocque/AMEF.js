/// <amd-dependency path="./utils.js" name="utils"/>

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