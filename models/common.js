/**
 * Created with IntelliJ IDEA.
 * User: retoblunschi
 * Date: 16.10.13
 * Time: 08:32
 * To change this template use File | Settings | File Templates.
 */
var mongoose = require('mongoose'),
    Schema = mongoose.Schema;

module.exports = {

    /**
     * abstract the mongoDB / mongoose Attributes from the porduced JSON
     * we do not want the clients to depend on our Database, so we
     * use generic attributes.
     *
     * @param definition
     * @param options
     * @returns {Schema}
     */
    newSchema: function(definition, options) {
        var mySchema = new Schema(definition, options);
        mySchema.set('toJSON', {
            transform: function(doc, ret, options) {
            ret.id = ret._id;
            delete ret._id;

            ret.version = ret.__v;
            delete ret.__v;

            delete ret.hashed_password;
            delete ret.tempPasswordFlag;
        }});

        return mySchema;
    },

    enums: {
        // Activity related enums
        source: "youpers community campaign".split(' '),
        plantype: "daily weekly once".split(' '),
        executiontype: "self group".split(' '),
        visibility: "private campaign public".split(' '),
        field: "AwarenessAbility Relaxation TimeManagement SocialInteraction WorkStructuring Breaks PhysicalActivity LeisureActivity Nutrition".split(' '),
        topic: "workLifeBalance",
        activityPlannedStatus: "active old".split(' '),

        // ActivityPlanEven enums
        activityPlanEventStatus: "open done missed".split(' '),

        // Assessment related enums
        questionType: "oneSided twoSided".split(' ')
    },

    initializeDbFor: function InitializeDbFor(Model) {
        console.log(Model.modelName + ": checking whether Database initialization is needed...");
        Model.find().exec(function (err, col) {
            if (err) {
                throw err;
            }
            if (col.length === 0) {
                var filename = '../dbdata/' + Model.modelName + '.json';
                var jsonFromFile;
                try {
                    jsonFromFile = require(filename);
                } catch (Error) {
                    console.log(Error);
                }
                if (jsonFromFile) {
                    console.log(Model.modelName + ": initializing assessment Database from File: " + filename);
                    console.log(jsonFromFile);
                    if (!Array.isArray(jsonFromFile)) {
                        jsonFromFile = [jsonFromFile];
                    }
                    jsonFromFile.forEach(function (jsonObj) {

                        var newObj = new Model(jsonObj);
                        console.log(newObj);
                        newObj.save(function (err) {
                            if (err) {
                                console.log(err.message);
                                throw err;
                            }
                            // fix for User Password hashing of imported users that already have an id in the json...
                            if (newObj.modelName = 'User' && !newObj.hashed_password) {
                                newObj.password = jsonObj.password;
                                newObj.save(function(err) {
                                    if (err) {
                                        console.log(err.message);
                                        throw err;
                                    }
                                });
                            }
                        });
                    });
                } else {
                    console.log(Model.modelName + ": no initialization, because no file found: " + filename);
                }
            } else {
                console.log(Model.modelName + ": no initialization needed, as we already have entities (" + col.length + ")");
            }
        });

    }
};