/**
 * Module dependencies.
 */

var mongoose = require('ypbackendlib').mongoose,
    ObjectId = mongoose.Schema.ObjectId,
    _ = require('lodash');

/**
 * User Schema Extension
 * @type {Schema}
 */


module.exports = {
    properties: {
        campaign: {type: ObjectId, ref: 'Campaign', select: false},
        allCampaigns: [
            {
                campaign: {type: ObjectId, ref: 'Campaign', select: false, required: true},
                joined: {type: Date, required: true}
            }
        ]
    },
    statics: {
        privatePropertiesSelector: '+email +roles +emailValidatedFlag +hashed_password +tempPasswordFlag +profile +username +campaign'
    },
    hooks: {
        pre: {
            save: [function (next, req, callback) {
                // if the user has a campaign set that is not yet in allCampaigns, add it to allCampaigns
                var usersCampaign = this.campaign;
                if (usersCampaign && !_.any(this.allCampaigns, function (allCampaignsObj) {
                        return (usersCampaign && (usersCampaign.id || usersCampaign.toString())) === allCampaignsObj.campaign;
                    })) {
                    this.allCampaigns.push({
                            campaign: usersCampaign.id || usersCampaign,
                            joined: new Date()
                        });
                }
                return callback ? next(callback) : next(req);
            }]
        }
    }
};
