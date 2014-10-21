module.exports = {

        // Idea related enums
        source: "youpers community campaign".split(' '),
        executiontype: "self group".split(' '),
        field: "AwarenessAbility Relaxation TimeManagement SocialInteraction WorkStructuring Breaks PhysicalEvent LeisureEvent Nutrition".split(' '),
        topic: "workLifeBalance",
        EventStatus: "active deleted old".split(' '),

        // EventEven enums
        occurenceStatus: "open done missed".split(' '),
        eventRecurrenceEndByType: "after on never".split(' '),
        eventFrequency: "once day week month year".split(' '),
        eventDeletable: "deletable deletableOnlyFutureEvents notDeletableNoFutureEvents".split(' '),
        eventEditable: "editable notEditableJoined notEditablePastEvent".split(' '),

        // Assessment related enums
        questionType: "twoSided leftSided rightSided".split(' '),
        questionCategory: "generalStresslevel atWork leisureTime stressType stressMeasures".split(' '),

        // Campaign related enums
        paymentStatus: "open paid".split(' '),
        campaignProductType: "CampaignProductType1 CampaignProductType2 CampaignProductType3".split(' '),
        calendarNotifications: "none 0 300 600 900 1800 3600 7200 86400 172800".split(' '),

        // type of the targeted space for a social interaction
        targetSpace: "user event campaign system email".split(' '),
        authorType: "user campaignLead productAdmin coach".split(' '),
        dismissalReason: "eventScheduled eventJoined denied campaignleadAccepted orgadminAccepted".split(' '),
        actionType: "assessment focus".split(' ')
};