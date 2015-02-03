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
        privatePropertiesSelector: '+email +roles +emailValidatedFlag +hashed_password +tempPasswordFlag +profile +username +campaign'
    }
};
