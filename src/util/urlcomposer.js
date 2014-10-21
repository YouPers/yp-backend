var config = require('../config/config'),
    webclientUrl = config.webclientUrl,
    backendUrl = config.backendUrl;

function eventUrl(campaignId, ideaId, eventId, soiId) {
    return webclientUrl + "/#/campaign/" + campaignId + '/idea/'+ideaId+ '/event/' + eventId + '/socialInteraction/' + (soiId || '') + '/';
}
function eventInviteUrl(invitationId) {
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
function ideaImageUrl (ideaNumber) {
    return webclientUrl + "/assets/actpics/"+ideaNumber + ".jpg";
}
function campaignImageUrl (imgPath) {
    return webclientUrl + imgPath;
}
function mailFooterImageUrl () {
    return webclientUrl + "/assets/img/yp_logo_mail_white.gif";
}
function icalUrl(eventId, type, userId) {
    return backendUrl + "/activities/" + eventId + '/ical?type='+ (type || 'new') + '&user=' + userId;
}
function profileUrl () {
    return webclientUrl + "/#/profile";
}

module.exports = {
    eventUrl: eventUrl,
    eventInviteUrl: eventInviteUrl,
    campaignLeadInviteUrl: campaignLeadInviteUrl,
    campaignWelcomeUrl: campaignWelcomeUrl,
    orgAdminInviteUrl: orgAdminInviteUrl,
    ideaImageUrl: ideaImageUrl,
    campaignImageUrl: campaignImageUrl,
    mailFooterImageUrl: mailFooterImageUrl,
    profileUrl: profileUrl,
    icalUrl: icalUrl
};