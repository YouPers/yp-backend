var env = process.env.NODE_ENV || 'development',
    config = require('../config/config')[env];

function activityOfferWebClientUrl(activityOfferId) {
    return config.webclientUrl + "/#/schedule/" + activityOfferId;
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
    return config.webclientUrl + "/#/schedule/" +planId + '/invitation?invitingUserId='+invitingUserId;
}
function campaignLeadInviteUrl(campaignId, invitingUserId, token) {
    return config.webclientUrl + "/#/campaigns/" + campaignId + '/becomeCampaignLead?invitingUserId='+invitingUserId+'&token='+token;
}
function orgAdminInviteUrl (organizationId, invitingUserId, token) {
    return config.webclientUrl + "/#/organizations/" + organizationId + '/becomeOrganizationAdmin?invitingUserId='+invitingUserId+'&token='+token;
}

module.exports = {
    activityOfferUrl: activityOfferWebClientUrl,
    activityPlanUrl: activityPlanWebClientUrl,
    emailVerificationUrl: emailVerificationUrl,
    passwordResetUrl: passwordResetUrl,
    activityPlanInviteUrl: activityPlanInviteUrl,
    campaignLeadInviteUrl: campaignLeadInviteUrl,
    orgAdminInviteUrl: orgAdminInviteUrl
};