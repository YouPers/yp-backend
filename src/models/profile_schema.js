/**
 * Profile Schema Extension
 * @type {Schema}
 */
module.exports = {
    properties: {
        coach: {type: String, required: false},
        selectedCategories: [{type: String}]
    },
    statics: {
    }
};
