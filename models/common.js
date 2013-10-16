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

        // Assessment related enums
        questionType: "oneSided twoSided".split(' ')
    }
};
