var env = process.env.NODE_ENV || 'development',
    config = require('../config/config')[env];

function activityWebClientUrl(activityId) {
    return config.webclientUrl + "/#/schedule/" + activityId;
}
function emailVerificationUrl(encryptedEmailAddress) {
    return config.webclientUrl + "/#/email_verification/" + encryptedEmailAddress;
}
function passwordResetUrl(encryptedToken, firstname, lastname) {
    return config.webclientUrl + "/#/password_reset/" + encryptedToken + "?firstname=" + firstname + "&lastname=" + lastname;
}

function activityInviteUrl(planId, invitingUserId) {
    return config.webclientUrl + "/#/invite/" + invitingUserId + '/activity/' + planId;
}
function campaignLeadInviteUrl(campaignId, invitingUserId, token) {
    return config.webclientUrl + "/#/campaigns/" + campaignId + '/becomeCampaignLead?invitingUserId='+invitingUserId+'&token='+token;
}
function orgAdminInviteUrl (organizationId, invitingUserId, token) {
    return config.webclientUrl + "/#/organizations/" + organizationId + '/becomeOrganizationAdmin?invitingUserId='+invitingUserId+'&token='+token;
}
function ideaImageUrl (ideaNumber) {
    return config.webclientUrl + "/assets/actpics/"+ideaNumber + ".jpg";
}
function campaignImageUrl () {
    return config.webclientUrl + "/assets/img/stressManagement.png";
}
function mailLogoImageUrl () {
    return config.webclientUrl + "/assets/img/yp_logo_mail.gif";
}
function mailFooterImageUrl () {
    return config.webclientUrl + "/assets/img/yp_logo_mail_white.gif";
}
function mailBackgroundImageUrl () {
    return config.webclientUrl + "/assets/img/green_background.jpg";
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