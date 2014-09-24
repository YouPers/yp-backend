var config = require('../config/config'),
    webclientUrl = config.webclientUrl,
    backendUrl = config.backendUrl;

function activityUrl(campaignId, ideaId, activityId, soiId) {
    return webclientUrl + "/#/campaign/" + campaignId + '/idea/'+ideaId+ '/activity/' + activityId + '/socialInteraction/' + (soiId || '') + '/';
}
function emailVerificationUrl(encryptedEmailAddress) {
    return webclientUrl + "/#/email_verification/" + encryptedEmailAddress;
}
function passwordResetUrl(encryptedToken, firstname, lastname) {
    return webclientUrl + "/#/password_reset/" + encryptedToken + "?firstname=" + firstname + "&lastname=" + lastname;
}

function activityInviteUrl(invitationId) {
    return webclientUrl + "/#/invite/" + invitationId;
}
function campaignLeadInviteUrl(campaignId, invitingUserId, token) {
    return webclientUrl + "/#/campaigns/" + campaignId + '/becomeCampaignLead?invitingUserId='+invitingUserId+'&token='+token;
}
function orgAdminInviteUrl (organizationId, invitingUserId, token) {
    return webclientUrl + "/#/organizations/" + organizationId + '/becomeOrganizationAdmin?invitingUserId='+invitingUserId+'&token='+token;
}
function ideaImageUrl (ideaNumber) {
    return webclientUrl + "/assets/actpics/"+ideaNumber + ".jpg";
}
function campaignImageUrl () {
    return webclientUrl + "/assets/img/stressManagement.png";
}
function mailLogoImageUrl () {
    return webclientUrl + "/assets/img/yp_logo_mail.gif";
}
function mailFooterImageUrl () {
    return webclientUrl + "/assets/img/yp_logo_mail_white.gif";
}
function mailBackgroundImageUrl () {
    return webclientUrl + "/assets/img/green_background.jpg";
}
function icalUrl(activityId, type, userId) {
    return backendUrl + "/activities/" + activityId + '/ical?type='+ (type || 'new') + '&user=' + userId;
}
function profileUrl () {
    return webclientUrl + "/#/profile";
}

module.exports = {
    activityUrl: activityUrl,
    emailVerificationUrl: emailVerificationUrl,
    passwordResetUrl: passwordResetUrl,
    activityInviteUrl: activityInviteUrl,
    campaignLeadInviteUrl: campaignLeadInviteUrl,
    orgAdminInviteUrl: orgAdminInviteUrl,
    ideaImageUrl: ideaImageUrl,
    campaignImageUrl: campaignImageUrl,
    mailLogoImageUrl: mailLogoImageUrl,
    mailFooterImageUrl: mailFooterImageUrl,
    mailBackgroundImageUrl: mailBackgroundImageUrl,
    profileUrl: profileUrl,
    icalUrl: icalUrl
};