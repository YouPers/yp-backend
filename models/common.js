/**
 * Created with IntelliJ IDEA.
 * User: retoblunschi
 * Date: 16.10.13
 * Time: 08:32
 * To change this template use File | Settings | File Templates.
 */


module.exports = {

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
        activityPlanEventStats: "open done".split(' '),

        // Assessment related enums
        questionType: "oneSided twoSided".split(' ')
    },

    initializeDbFor : function InitializeDbFor(Model) {
        console.log(Model.modelName + ": checking whether Database initialization is needed...");
        Model.find().exec(function (err, col) {
            if (err) {
                throw err;
            }
            if (col.length === 0) {
                var filename = '../dbdata/' + Model.modelName + '.json';
                var jsonFromFile = require(filename);
                if (jsonFromFile) {
                    console.log(Model.modelName + ": initializing assessment Database from File: " + filename);
                    console.log(jsonFromFile);
                    var newObj = new Model(jsonFromFile);
                    console.log(newObj);
                    newObj.save(function (err) {
                        if (err) {
                            console.log(err.message);
                        }
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
