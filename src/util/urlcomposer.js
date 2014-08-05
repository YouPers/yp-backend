var config = require('../config/config'),
    webclientUrl = config.webclientUrl;

function activityWebClientUrl(activityId) {
    return webclientUrl + "/#/schedule/" + activityId;
}
function emailVerificationUrl(encryptedEmailAddress) {
    return webclientUrl + "/#/email_verification/" + encryptedEmailAddress;
}
function passwordResetUrl(encryptedToken, firstname, lastname) {
    return webclientUrl + "/#/password_reset/" + encryptedToken + "?firstname=" + firstname + "&lastname=" + lastname;
}

function activityInviteUrl(planId, invitingUserId) {
    return webclientUrl + "/#/invite/" + invitingUserId + '/activity/' + planId;
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

module.exports = {
    activityUrl: activityWebClientUrl,
    emailVerificationUrl: emailVerificationUrl,
    passwordResetUrl: passwordResetUrl,
    activityInviteUrl: activityInviteUrl,
    campaignLeadInviteUrl: campaignLeadInviteUrl,
    orgAdminInviteUrl: orgAdminInviteUrl,
    ideaImageUrl: ideaImageUrl,
    campaignImageUrl: campaignImageUrl,
    mailLogoImageUrl: mailLogoImageUrl,
    mailFooterImageUrl: mailFooterImageUrl,
    mailBackgroundImageUrl: mailBackgroundImageUrl
};