var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    _ = require('lodash'),
    auth = require('../util/auth'),
    swaggerAdapter = require('../util/swaggerMongooseAdapter');
var timestamps = require('mongoose-timestamp');

module.exports = {

    /**
     * general additions that all our Schemas can use.
     *
     * @param definition
     * @param options
     * @returns {Schema}
     */
    newSchema: function (definition, options) {

        // we keep track of all i18n strings on this schema
        var multilingualValues = [];

        // TODO: Move to some global config
        var supportedLanguages = ['de', 'en', 'fr', 'it'];
        var defaultLanguage = 'de';

        // go through all properties defined for this model
        // for every prop check whether it has the attribute i18n with value true
        // for every such i18n property replace the simple String model by a struct: {de: String, fr: String, ....}
        // so, in the database we store an object with a key for each language instead of just a String.
        // we change the key from 'keyname' to 'keynameI18n'
        _.forEach(definition, function (value, key) {
            value = definition[key];
            if ('i18n' in value && value['i18n'] === true) {
                delete value['i18n'];

                multilingualValues.push(key);

                var struct = {};
                _.forEach(supportedLanguages, function (lang) {
                    struct[lang] = value;
                    if ((lang !== defaultLanguage) && 'required' in value && value['required'] === true) {
                        delete struct[lang]['required'];
                    }
                });
                definition[key + 'I18n'] = struct;
                delete definition[key];
            }
        });

        var mySchema = new Schema(definition, options);

        // To make it easy for clients/handlers/controllers to access the i18n properties we add virtual
        // getters and setters
        _.forEach(multilingualValues, function (key) {
            mySchema.virtual(key)
                // the getter check whether one or multiple languages have been loaded from the Database in the
                // property 'keynameI18n'. If only one was loaded, it returns the unwrapped value, because the
                // client has asked for only one locale and we queried the Database to only return this locale
                // if more than one locale was loaded we return the full struct and expects the client to handle it.
                .get(function () {
                    var myValue = this[key + 'I18n'];
                    var nrOfLocalesLoaded = _.keys(myValue.toObject()).length;
                    if (nrOfLocalesLoaded === 1) {
                        return myValue[_.keys(myValue.toObject())[0]];
                    } else if (nrOfLocalesLoaded === 0) {
                        // TODO: find a way to deliver a reasonable Fallback in this case, needs adjusting of the querySelector!!!
                        return "MISSING TRANSLATION";
                    } else {
                        // many locales loaded, --> the client wants all locales, we give him the full object.
                        return  myValue;
                    }
                })
                .set(function (value) {
                    this[key + 'I18n'] = {};
                    this[key + 'I18n'][defaultLanguage] = value;
                });
        });

        /**
         * This Method returns an Object that can be given to any mongoose Database query with a
         * .select() statement. When you use this selector, the query will return only the passed in locale
         * for any i18n=true properties. And the JSON Formatter of this schema will then unwrap the i18n objects
         * into normal localized String.
         *
         * @param locale the locale to be loaded.
         * @param basePath used for recursive calls, do not pass any value when you call this Fn in a controller.
         * @returns {*} that can be given to mongoose.query.select()
         */
        mySchema.statics.getI18nPropertySelector = function (locale, basePath) {

            var selectObj = {};
            basePath = basePath ? basePath + '.' : '';

            // add the multilingual Values of this Model
            _.forEach(multilingualValues, function (prop) {
                _.forEach(supportedLanguages, function (lng) {
                    if (lng !== locale) {
                        selectObj[basePath + prop + 'I18n.' + lng] = 0;
                    }
                });
            });

            // recursivly call for all subSchemas and merge the results together
            _.forEach(definition, function (value, key) {
                var propertyType = Array.isArray(value) ? value[0] : value;
                if (propertyType instanceof mongoose.Schema) {
                    _.merge(selectObj, propertyType.statics.getI18nPropertySelector(locale, basePath ? basePath + key : key));
                }
            });
            return selectObj;
        };

        mySchema.statics.adminRoles = [auth.roles.systemadmin];

        /**
         * overwrite the way we generally render objects to JSON.
         *
         * This is called automatically for every subschema, so we do not have to do recursion ourselves.
         */
        mySchema.set('toJSON', {
            transform: function (doc, ret, options) {
                ret.id = ret._id;
                delete ret._id;

                // handler viruals into the JSON
                // TODO: move the configuration whish virtuals to output as JSON into a property of
                // the schema instead of this ifs here

                if (doc.deleteStatus) {
                    ret.deleteStatus = doc.deleteStatus;
                }

                if (doc.editStatus) {
                    ret.editStatus = doc.editStatus;
                }

                if (doc.sourceType) {
                    ret.sourceType = doc.sourceType;
                }

                if (_.isNumber(doc.planCount)) {
                    ret.planCount = doc.planCount;
                }

                _.forEach(multilingualValues, function (prop) {

                    // enable the virtual
                    ret[prop] = doc[prop];

                    // the real stored db value is hidden from the client.
                    delete ret[prop + 'I18n'];
                });

                if (doc.toJsonConfig && doc.toJsonConfig.hide) {
                    _.forEach(doc.toJsonConfig.hide, function (propertyToHide) {
                        delete ret[propertyToHide];
                    });
                }
            }});

        /**
         * This function takes a mongoose Schema description and outputs the same schema as a swagger model to be
         * consumed by Swagger.
         *
         * @returns {{}}
         */
        mySchema.statics.getSwaggerModel = function () {
            return swaggerAdapter.getSwaggerModel(this);
        };

        mySchema.plugin(timestamps, {updatedAt: 'updated', createdAt: 'created'
        });

        mySchema.methods.getStatsString = function() {
            return this.title;
        };

        return mySchema;
    },

    enums: {
        // Activity related enums
        source: "youpers community campaign".split(' '),
        executiontype: "self group".split(' '),
        visibility: "private campaign public".split(' '),
        field: "AwarenessAbility Relaxation TimeManagement SocialInteraction WorkStructuring Breaks PhysicalActivity LeisureActivity Nutrition".split(' '),
        topic: "workLifeBalance",
        ActivityPlanStatus: "active old".split(' '),

        // ActivityPlanEven enums
        activityPlanEventStatus: "open done missed".split(' '),
        activityRecurrenceEndByType: "after on never".split(' '),
        activityPlanFrequency: "once day week month year".split(' '),
        activityPlanDeletable: "deletable deletableOnlyFutureEvents notDeletableJoinedUsers notDeletableJoinedPlans notDeletableNoFutureEvents".split(' '),
        activityPlanEditable: "editable notEditableJoinedPlans notEditableJoinedUsers notEditableNotSingleEvent notEditablePastEvent".split(' '),

        // Assessment related enums
        questionType: "oneSided twoSided".split(' '),
        questionCategory: "generalStresslevel atWork leisureTime stressType stressMeasures".split(' '),

        // Profile related enums
        gender: "undefined female male".split(' '),
        maritalStatus: "undefined single unmarried married separated divorced widowed".split(' '),

        // Preference related enums
        firstDayOfWeek: "Monday Sunday".split(' '),
        // Campaign related enums
        relatedService: "YP-Balance".split(' '),
        paymentStatus: "open paid".split(' '),
        campaignProductType: "CampaignProductType1 CampaignProductType2 CampaignProductType3".split(' '),
        calendarNotifications: "none 0 300 600 900 1800 3600 7200 86400 172800".split(' '),

        // activityOffers
        activityOfferType: "campaignActivity campaignActivityPlan ypHealthCoach personalInvitation publicActivityPlan defaultActivity".split(' ')
    }
};