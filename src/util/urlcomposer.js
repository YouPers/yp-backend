var config = require('../config/config'),
    webclientUrl = config.webclientUrl,
    backendUrl = config.backendUrl;


function homeUrl() {
    return webclientUrl;
}

function dcmBaseUrl(campaignId) {
    return webclientUrl + "/#/dcm/campaign/" + campaignId;
}
function dcmHomeUrl(campaignId) {
    return dcmBaseUrl(campaignId) + '/home';
}
function dcmMessagesUrl(campaignId) {
    return dcmHomeUrl(campaignId) + '?section=messages';
}
function dcmBrowseIdeas(campaignId, executionType) {
    return dcmBaseUrl(campaignId) + '/ideas' + (executionType ? '?type=' + executionType : '');
}
function dcmCreateIdea(campaignId) {
    return dcmBaseUrl(campaignId) + '/ideas/';
}

function adminBaseUrl() {
    return webclientUrl + '/#/admin';
}
function adminEditIdea(ideaId) {
    return adminBaseUrl() + '/ideas/' + ideaId + '/admin';
}
function adminEditAssessments() {
    return adminBaseUrl() + '/assessments';
}

function activityUrl(campaignId, ideaId, activityId, soiId, actionType) {
    if (actionType === 'assessment') {
        return webclientUrl + "/#/campaign/" + campaignId + '/check';
    } else {
        return webclientUrl + "/#/campaign/" + campaignId + '/idea/'+ideaId+ '/activity/' + activityId + '/socialInteraction/' + (soiId || '');
    }
}

function dcmActivityUrl(campaignId, ideaId, activityId, soiId) {
        return webclientUrl + "/#/dcm/campaign/" + campaignId +'/idea/'+ideaId+ '/activity/' + activityId + '/socialInteraction/' + (soiId || '');
}

function activityInviteUrl(invitationId) {
    return webclientUrl + "/#/invite/" + invitationId;
}
function campaignLeadInviteAndResetPasswordUrl(campaignId, invitingUserId, invitedUserId, username, token) {
    return webclientUrl + "/#/campaigns/" + campaignId + '/campaignLeadResetPassword' +
        '?invitingUserId=' + invitingUserId +
        '&invitedUserId=' + invitedUserId +
        '&username=' + encodeURIComponent(username) +
        '&accessToken=' + token;
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
function prefixRelativeImageUrl(url) {
    return url.indexOf('/') === 0 ? (homeUrl() + url) : url;
}
function assetUrl(fileName) {
    return homeUrl() + '/assets/img/' + fileName;
}

module.exports = {
    homeUrl: homeUrl,
    dcmHomeUrl: dcmHomeUrl,
    dcmMessagesUrl: dcmMessagesUrl,
    dcmBrowseIdeas: dcmBrowseIdeas,
    dcmCreateIdea: dcmCreateIdea,
    adminEditIdea: adminEditIdea,
    adminEditAssessments: adminEditAssessments,
    activityUrl: activityUrl,
    dcmActivityUrl: dcmActivityUrl,
    activityInviteUrl: activityInviteUrl,
    campaignLeadInviteAndResetPasswordUrl: campaignLeadInviteAndResetPasswordUrl,
    campaignWelcomeUrl: campaignWelcomeUrl,
    orgAdminInviteUrl: orgAdminInviteUrl,
    ideaImageUrl: ideaImageUrl,
    campaignImageUrl: campaignImageUrl,
    profileUrl: profileUrl,
    prefixRelativeImageUrl: prefixRelativeImageUrl,
    assetUrl: assetUrl,
    icalUrl: icalUrl
};