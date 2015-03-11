var config = require('../config/config'),
    webclientUrl = config.webclientUrl,
    backendUrl = config.backendUrl;


function homeUrl() {
    return webclientUrl;
}
function activityUrl(campaignId, ideaId, activityId, soiId, actionType) {
    if (actionType === 'assessment') {
        return webclientUrl + "/#/campaign/" + campaignId + '/check';
    } else {
        return webclientUrl + "/#/campaign/" + campaignId + '/idea/'+ideaId+ '/activity/' + activityId + '/socialInteraction/' + (soiId || '');
    }
}
function activityInviteUrl(invitationId) {
    return webclientUrl + "/#/invite/" + invitationId;
}
function campaignLeadInviteUrl(campaignId, invitingUserId, token) {
    return webclientUrl + "/#/campaigns/" + campaignId + '/becomeCampaignLead?invitingUserId='+invitingUserId+'&accessToken='+token;
}
function campaignLeadInviteAndResetPasswordUrl(campaignId, invitingUserId, token) {
    return webclientUrl + "/#/campaigns/" + campaignId + '/campaignLeadResetPassword?invitingUserId='+invitingUserId+'&accessToken='+token;
}
function campaignWelcomeUrl(campaignId) {
    return webclientUrl + "/#/welcome/" + campaignId + '/';
}
function orgAdminInviteUrl (organizationId, invitingUserId, token) {
    return webclientUrl + "/#/organizations/" + organizationId + '/becomeOrganizationAdmin?invitingUserId='+invitingUserId+'&token='+token;
}
function ideaImageUrl (idea) {
    return idea.picture;
}
function campaignImageUrl (imgPath) {
    return webclientUrl + imgPath;
}
function icalUrl(activityId, type, userId) {
    return backendUrl + "/activities/" + activityId + '/ical.ics?type='+ (type || 'new') + '&user=' + userId;
}
function profileUrl () {
    return webclientUrl + "/#/profile?settings";
}

module.exports = {
    homeUrl: homeUrl,
    activityUrl: activityUrl,
    activityInviteUrl: activityInviteUrl,
    campaignLeadInviteUrl: campaignLeadInviteUrl,
    campaignLeadInviteAndResetPasswordUrl: campaignLeadInviteAndResetPasswordUrl,
    campaignWelcomeUrl: campaignWelcomeUrl,
    orgAdminInviteUrl: orgAdminInviteUrl,
    ideaImageUrl: ideaImageUrl,
    campaignImageUrl: campaignImageUrl,
    profileUrl: profileUrl,
    icalUrl: icalUrl
};