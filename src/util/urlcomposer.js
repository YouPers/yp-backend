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
function mailFooterImageUrl () {
    return webclientUrl + "/assets/img/yp_logo_mail_white.gif";
}
function icalUrl(activityId, type, userId) {
    return backendUrl + "/activities/" + activityId + '/ical?type='+ (type || 'new') + '&user=' + userId;
}
function profileUrl () {
    return webclientUrl + "/#/profile";
}

module.exports = {
    homeUrl: homeUrl,
    activityUrl: activityUrl,
    activityInviteUrl: activityInviteUrl,
    campaignLeadInviteUrl: campaignLeadInviteUrl,
    campaignWelcomeUrl: campaignWelcomeUrl,
    orgAdminInviteUrl: orgAdminInviteUrl,
    ideaImageUrl: ideaImageUrl,
    campaignImageUrl: campaignImageUrl,
    mailFooterImageUrl: mailFooterImageUrl,
    profileUrl: profileUrl,
    icalUrl: icalUrl
};