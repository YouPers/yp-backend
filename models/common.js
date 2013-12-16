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
                'ObjectId': 'ObjectId',
                'Number': 'integer',
                'Boolean': 'boolean'
            };

            var swaggerModels = {};

            function createNewModel(modelName) {
                return {
                    id: modelName,
                    required: ['id'],
                    properties: {
                        id: {type: 'ObjectId'}
                    }
                };
            }

            var mainModel = createNewModel.call(this.modelName);
            swaggerModels[this.modelName] = mainModel;

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
                    type: 'array',
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

            function createAndRegisterNewSwaggerModel(subModelName) {
                var subModel = createNewModel(subModelName);
                swaggerModels[subModelName] = subModel;
                return subModel;
            }

            function handleSubSchemaProperty(propertyName, type, parentModel) {
                var subModelName = type.modelName || (_.last(propertyName) === 's' ? propertyName.slice(0, -1) : propertyName);
                if (!swaggerModels[subModelName]) {
                    var subModel = createAndRegisterNewSwaggerModel(subModelName);
                    addModelPaths(type.paths, subModel);
                }
                return subModelName;
            }

            function handleEmbeddedDocProperty(propertyName, type) {
                var subModelName = _.last(propertyName) === 's' ? propertyName.slice(0, -1) : propertyName;
                var swaggerSubModel = createAndRegisterNewSwaggerModel(subModelName);
                addEmbeddedDocProps(type, swaggerSubModel);
                return subModelName;
            }

            function addModelPaths(paths, targetModel) {
                _.forEach(paths, function (path, propertyName) {
                    if (_.indexOf(hiddenProps, propertyName) === -1) {
                        var type = path.options.type;
                        var subModelName;
                        if (isArray(type)) {
                            addArrayProperty(propertyName, path.options.type[0], targetModel);
                        } else if (isSubSchema(type)) {
                            subModelName = handleSubSchemaProperty(propertyName, type, targetModel);
                            targetModel.properties[propertyName] = {type: subModelName};
                        } else if (isEmbeddedDoc(type)) {
                            subModelName = handleEmbeddedDocProperty(propertyName, type, targetModel);
                            targetModel.properties[propertyName] = {type: subModelName};
                        } else {
                            targetModel.properties[propertyName] = {
                                type: typeMap[path.options.type.name] || path.options.type.name
                            };
                        }
                        var desc = fieldDescriptions[propertyName] || fieldDescriptions[targetModel.id + '.' + propertyName];
                        if (desc) {
                            targetModel.properties[propertyName].description = desc;
                        }
                        if (Array.isArray(path.enumValues) && path.enumValues.length > 0) {
                            targetModel.properties[propertyName].enum = path.enumValues;
                        }

                        if (path.isRequired) {
                            targetModel.required.push(propertyName);
                        }
                    }
                });
            }

            addModelPaths(this.schema.paths, mainModel);

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
        questionType: "oneSided twoSided".split(' ')
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