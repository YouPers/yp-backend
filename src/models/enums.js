module.exports = {

        // Idea related enums
        source: "youpers community campaign".split(' '),
        executiontype: "self group".split(' '),
        field: "AwarenessAbility Relaxation TimeManagement SocialInteraction WorkStructuring Breaks PhysicalActivity LeisureActivity Nutrition".split(' '),
        topic: "workLifeBalance",
        ActivityStatus: "active deleted old".split(' '),

        // ActivityEven enums
        activityEventStatus: "open done missed".split(' '),
        activityRecurrenceEndByType: "after on never".split(' '),
        activityFrequency: "once day week month year".split(' '),
        activityDeletable: "deletable deletableOnlyFutureEvents notDeletableNoFutureEvents".split(' '),
        activityEditable: "editable notEditableJoined notEditablePastEvent".split(' '),

        // Assessment related enums
        questionType: "twoSided leftSided rightSided".split(' '),
        questionCategory: "generalStresslevel atWork leisureTime stressType stressMeasures".split(' '),

        // Campaign related enums
        paymentStatus: "open paid".split(' '),
        campaignProductType: "CampaignProductType1 CampaignProductType2 CampaignProductType3".split(' '),
        calendarNotifications: "none 0 300 600 900 1800 3600 7200 86400 172800".split(' '),
        templateCampaignOfferType: "Recommendation Invitation Message".split(' '),
        templateCampaignOfferWeekday: "MO TU WE TH FR SA SU".split(' '),
        endorsementType: ['presented', 'sponsored'],

        // type of the targeted space for a social interaction
        targetSpace: "user activity campaign system email".split(' '),
        authorType: "user campaignLead productAdmin coach expert".split(' '),
        dismissalReason: "activityScheduled activityJoined denied campaignleadAccepted orgadminAccepted".split(' '),
        actionType: "assessment focus".split(' ')
};