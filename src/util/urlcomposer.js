var env = process.env.NODE_ENV || 'development',
    config = require('../config/config')[env];

function activityOfferWebClientUrl(activityId) {

    return config.webclientUrl + "/#/schedule/" + ((activityId.toJSON && activityId.toJSON()) || activityId);
}

function activityPlanWebClientUrl(activityPlanId) {
    return config.webclientUrl + "/#/schedule/" + activityPlanId;
}
function emailVerificationUrl(encryptedEmailAddress) {
    return config.webclientUrl + "/#/email_verification/" + encryptedEmailAddress;
}
function passwordResetUrl(encryptedToken, firstname, lastname) {
    return config.webclientUrl + "/#/password_reset/" + encryptedToken + "?firstname=" + firstname + "&lastname=" + lastname;
}

function activityPlanInviteUrl(planId, invitingUserId) {
    return config.webclientUrl + "/#/invite/" + invitingUserId + '/activity/' + planId;
}
function campaignLeadInviteUrl(campaignId, invitingUserId, token) {
    return config.webclientUrl + "/#/campaigns/" + campaignId + '/becomeCampaignLead?invitingUserId='+invitingUserId+'&token='+token;
}
function orgAdminInviteUrl (organizationId, invitingUserId, token) {
    return config.webclientUrl + "/#/organizations/" + organizationId + '/becomeOrganizationAdmin?invitingUserId='+invitingUserId+'&token='+token;
}
function activityImageUrl (activityNumber) {
    return config.webclientUrl + "/assets/actpics/"+activityNumber + ".jpg";
}

module.exports = {
    activityOfferUrl: activityOfferWebClientUrl,
    activityPlanUrl: activityPlanWebClientUrl,
    emailVerificationUrl: emailVerificationUrl,
    passwordResetUrl: passwordResetUrl,
    activityPlanInviteUrl: activityPlanInviteUrl,
    campaignLeadInviteUrl: campaignLeadInviteUrl,
    orgAdminInviteUrl: orgAdminInviteUrl,
    activityImageUrl: activityImageUrl
};