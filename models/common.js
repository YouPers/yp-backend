/**
 * Created with IntelliJ IDEA.
 * User: retoblunschi
 * Date: 16.10.13
 * Time: 08:32
 * To change this template use File | Settings | File Templates.
 */
var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    _ = require('lodash');

module.exports = {

    /**
     * abstract the mongoDB / mongoose Attributes from the porduced JSON
     * we do not want the clients to depend on our Database, so we
     * use generic attributes.
     *
     * @param definition
     * @param options
     * @returns {Schema}
     */
    newSchema: function (definition, options) {
        var mySchema = new Schema(definition, options);
        mySchema.set('toJSON', {
            transform: function (doc, ret, options) {
                ret.id = ret._id;
                delete ret._id;

                ret.version = ret.__v;
                delete ret.__v;

                if (doc.toJsonConfig && doc.toJsonConfig.hide) {
                    _.forEach(doc.toJsonConfig.hide, function (propertyToHide) {
                        delete ret[propertyToHide];
                    });
                }
            }});

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
                var newModel =  {
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

            var hiddenProps = this.toJsonConfig && this.toJsonConfig().hide || [];
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
                        for (var i= 0; i< parts.length; i++) {
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
                            realTargetModel = nestedSwaggerModels[propertyName.substring(0, _.lastIndexOf(propertyName,'.'))];
                            realPropertyName = propertyName.substring(_.lastIndexOf(propertyName,'.')+1);
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
        ActivityPlanFrequency: "once day week month year".split(' '),

        // Assessment related enums
        questionType: "oneSided twoSided".split(' '),

        // Profile related enums
        gender: "undefined female male".split(' ')                         ,
        maritalStatus: "undefined single unmarried married separated divorced widowed".split(' '),

        // Preference related enums
        firstDayOfWeek: "Monday Sunday".split(' '),
        defaultUserWeekForScheduling: "Monday Tuesday Wednesday Thursday Friday Saturday Sunday".split(' '),
        languageUI: "German English Italian".split(' ')

    },

    initializeDbFor: function InitializeDbFor(Model) {
        Model.find().exec(function (err, col) {
            if (err) {
                throw err;
            }
            if (col.length === 0) {
                var filename = '../dbdata/' + Model.modelName + '.json';
                var jsonFromFile;
                try {
                    jsonFromFile = require(filename);
                } catch (Error) {
                    console.log(Error);
                }
                if (jsonFromFile) {
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
                                console.log(err.message);
                                throw err;
                            }
                            // fix for User Password hashing of imported users that already have an id in the json...
                            if (newObj.modelName = 'User' && !newObj.hashed_password) {
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
                    console.log(Model.modelName + ": no initialization, because no file found: " + filename);
                }
            } else {
                console.log(Model.modelName + ": no initialization needed, as we already have entities (" + col.length + ")");
            }
        });

    }
}
;