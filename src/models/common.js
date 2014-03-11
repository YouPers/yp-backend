var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    _ = require('lodash'),
    env = process.env.NODE_ENV || 'development',
    config = require('../config/config')[env],
    auth = require('../util/auth');

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
         * @returns {} that can be given to mongoose.query.select()
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

                ret.version = ret.__v;
                delete ret.__v;

                // store manually the virtual doc.deleteStatus to the return value
                if (doc.deleteStatus) {
                    ret.deleteStatus = doc.deleteStatus;
                }

                // store manually the virtual doc.editStatus to the return value
                if (doc.editStatus) {
                    ret.editStatus = doc.editStatus;
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

            var typeMap = {
                'String': 'string',
                'Date': 'Date',
                'ObjectId': 'string',
                'Number': 'long',
                'Boolean': 'boolean',
                'integer': 'long',
                'Mixed': 'string'
            };

            var swaggerModels = {};

            function createAndRegisterNewSwaggerModel(modelName) {
                var newModel = {
                    id: modelName,
                    required: ['id'],
                    properties: {
                        id: {type: 'string'}
                    }
                };
                swaggerModels[modelName] = newModel;
                return newModel;
            }

            var mainModel = createAndRegisterNewSwaggerModel(this.modelName);

            var hiddenProps = this.toJsonConfig && this.toJsonConfig.hide || [];
            hiddenProps = hiddenProps.concat(['__v', '_id']);
            var fieldDescriptions = this.getFieldDescriptions && this.getFieldDescriptions() || {};


            function addEmbeddedDocProps(parentType, targetModel) {
                var subModelName;
                _.forOwn(parentType, function (property, propertyName) {

                        if (isReference(property.type)) {
                            targetModel.properties[propertyName] = {type: property.type.type.name};
                        } else if (isArray(property)) {
                            addArrayProperty(propertyName, property, targetModel);
                        } else if (isSubSchema(property.type)) {
                            subModelName = handleSubSchemaProperty(propertyName, property.type, targetModel);
                            targetModel.properties[propertyName].items['$ref'] = subModelName;
                        } else if (isEmbeddedDoc(property.type)) {
                            subModelName = handleEmbeddedDocProperty(propertyName, property.type, targetModel);
                            targetModel.properties[propertyName].items['$ref'] = subModelName;
                        } else if (property.type && property.type.name) {
                            targetModel.properties[propertyName] = {type: typeMap[property.type.name] || property.type.name};
                        } else if (property.name) {
                            targetModel.properties[propertyName] = {type: typeMap[property.name] || property.name};
                        }
                        else {
                            throw new Error('unknown type for: ' + propertyName + ' propType: ' + property);
                        }
                        var desc = fieldDescriptions[propertyName] || fieldDescriptions[targetModel.id + '.' + propertyName];
                        if (desc) {
                            targetModel.properties[propertyName].description = desc;
                        }
                    }
                );
            }

            // iterate over schema.paths, add to swaggerModel
            function addArrayProperty(propertyName, type, targetModel) {
                targetModel.properties[propertyName] = {
                    type: 'Array',
                    items: {}
                };

                //  type inside Array
                var subModelName;

                if (isReference(type)) {
                    targetModel.properties[propertyName].items['$ref'] = typeMap[type.ref] || type.ref;
                } else if (isArray(type)) {
                    addArrayProperty(propertyName, type[0], targetModel);
                } else if (isSubSchema(type)) {
                    subModelName = handleSubSchemaProperty(propertyName, type, targetModel);
                    targetModel.properties[propertyName].items['$ref'] = subModelName;
                } else if (isEmbeddedDoc(type)) {
                    subModelName = handleEmbeddedDocProperty(propertyName, type, targetModel);
                    targetModel.properties[propertyName].items['$ref'] = subModelName;
                } else if (type && type.name) {
                    targetModel.properties[propertyName].items.type = typeMap[type.name] || type.name;
                } else {
                    throw new Error('type of arrayElement is not yet supported inside an Array: ' + propertyName);
                }
                var desc = fieldDescriptions[propertyName] || fieldDescriptions[targetModel.id + '.' + propertyName];
                if (desc) {
                    targetModel.properties[propertyName].description = desc;
                }

            }

            function isReference(type) {
                return type && type.type && type.type.name === 'ObjectId';
            }

            function isSubSchema(type) {
                return type instanceof Schema;
            }

            function isEmbeddedDoc(type) {
                return _.isPlainObject(type);
            }

            function isArray(type) {
                return Array.isArray(type);
            }


            function handleSubSchemaProperty(propertyName, type, parentModel) {
                var subModelName = type.modelName || getModelNameFromPropertyName(propertyName);
                if (!swaggerModels[subModelName]) {
                    var subModel = createAndRegisterNewSwaggerModel(subModelName);
                    addModelPaths(type.paths, type.nested, subModel);
                }
                return subModelName;
            }

            function getModelNameFromPropertyName(propertyName, dontDepluralize) {
                return _.last(propertyName) === 's' && !dontDepluralize ?
                    propertyName.charAt(0).toUpperCase() + propertyName.slice(1, -1)
                    : propertyName.charAt(0).toUpperCase() + propertyName.slice(1);
            }

            function handleEmbeddedDocProperty(propertyName, type) {
                var subModelName = getModelNameFromPropertyName(propertyName);

                var swaggerSubModel = createAndRegisterNewSwaggerModel(subModelName);
                addEmbeddedDocProps(type, swaggerSubModel);
                return subModelName;
            }

            function addModelPaths(paths, nestedPaths, targetModel) {
                var nestedSwaggerModels = {};
                // first we need to add nestedModels for each nestedPath
                if (nestedPaths && _.size(nestedPaths) > 0) {
                    _.forEach(nestedPaths, function (value, nestedPath) {
                        var parts = nestedPath.split('.');
                        var combinedPath = '';
                        var parentModel = targetModel;
                        for (var i = 0; i < parts.length; i++) {
                            combinedPath = combinedPath ? combinedPath + '.' + parts[i] : parts[i];
                            if (!nestedSwaggerModels[combinedPath]) {
                                var modelName = getModelNameFromPropertyName(parts[i], true);
                                nestedSwaggerModels[combinedPath] = createAndRegisterNewSwaggerModel(modelName);
                                parentModel.properties[parts[i]] = {type: modelName};
                            }
                            parentModel = nestedSwaggerModels[combinedPath];
                        }
                    });
                }

                _.forEach(paths, function (path, propertyName) {
                    if (_.indexOf(hiddenProps, propertyName) === -1) {
                        var realTargetModel = targetModel;
                        var realPropertyName = propertyName;
                        if (propertyName.indexOf('.') !== -1) {
                            realTargetModel = nestedSwaggerModels[propertyName.substring(0, _.lastIndexOf(propertyName, '.'))];
                            realPropertyName = propertyName.substring(_.lastIndexOf(propertyName, '.') + 1);
                        }
                        var type = path.options.type;
                        var subModelName;
                        if (isArray(type)) {
                            addArrayProperty(realPropertyName, path.options.type[0], realTargetModel);
                        } else if (isSubSchema(type)) {
                            subModelName = handleSubSchemaProperty(realPropertyName, type, realTargetModel);
                            realTargetModel.properties[realPropertyName] = {type: subModelName};
                        } else if (isEmbeddedDoc(type)) {
                            subModelName = handleEmbeddedDocProperty(realPropertyName, type, realTargetModel);
                            realTargetModel.properties[realPropertyName] = {type: subModelName};
                        } else {
                            realTargetModel.properties[realPropertyName] = {
                                type: typeMap[path.options.type.name] || path.options.type.name
                            };
                        }


                        var desc = fieldDescriptions[propertyName] || fieldDescriptions[realTargetModel.id + '.' + propertyName];
                        if (desc) {
                            realTargetModel.properties[realPropertyName].description = desc;
                        }
                        if (Array.isArray(path.enumValues) && path.enumValues.length > 0) {
                            realTargetModel.properties[realPropertyName].enum = path.enumValues;
                        }

                        if (path.isRequired) {
                            realTargetModel.required.push(realPropertyName);
                        }
                    }
                });
            }

            addModelPaths(this.schema.paths, this.schema.nested, mainModel);

            return swaggerModels;
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

        service: "a b".split(' '),
        productType: "a b".split(' ')
    },

    initializeDbFor: function InitializeDbFor(Model) {
        if (config.loadTestData) {
            // load all existing objects
            Model.count().exec(function (err, count) {
                if (err) {
                    throw err;
                }
                var filename = '../../dbdata/' + Model.modelName + '.json';
                var jsonFromFile;
                try {
                    jsonFromFile = require(filename);
                } catch (Error) {
                    // silent fail, because if we did not find the file, there is nothing to load. This is expected
                    // for some objects.
                }
                if (jsonFromFile) {
                    if (jsonFromFile.length > count) {
                        console.log(Model.modelName + ": initializing Database from File: " + filename);
                        if (!Array.isArray(jsonFromFile)) {
                            jsonFromFile = [jsonFromFile];
                        }
                        jsonFromFile.forEach(function (jsonObj) {
                            if (jsonObj.id) {
                                jsonObj._id = jsonObj.id;
                            }
                            var newObj = new Model(jsonObj);

                            newObj.save(function (err) {
                                if (err) {
                                    if (err.code === 11000) {
                                        console.log(Model.modelName + ": not saving Obj: " + jsonObj._id + " because it is already in the database");
                                    } else {
                                        console.log(err.message);
                                        throw err;
                                    }
                                }
                                // fix for User Password hashing of imported users that already have an id in the json...
                                if (newObj.modelName === 'User' && !newObj.hashed_password) {
                                    newObj.password = jsonObj.password;
                                    newObj.save(function (err) {
                                        if (err) {
                                            console.log(err.message);
                                            throw err;
                                        }
                                    });
                                }
                            });
                        });
                    } else {
                        console.log(Model.modelName + ": no initialization, more or same number of instances already in Database (" + count + ") than in JSON-File (" + jsonFromFile.length + ")");
                    }
                } else {
                    console.log(Model.modelName + ": no initialization, because no load file exists for this Model");
                }
            });
        } else {
            console.log("no DB initialization because it is disabled for this enviroment");
        }
    }

}
;