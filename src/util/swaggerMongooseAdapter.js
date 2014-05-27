var _ = require('lodash'),
    mongoose = require('mongoose'),
    Schema = mongoose.Schema;

function getSwaggerModel(aMongooseModel) {

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

    var mainModel = createAndRegisterNewSwaggerModel(aMongooseModel.modelName);

    var hiddenProps = aMongooseModel.toJsonConfig && aMongooseModel.toJsonConfig.hide || [];
    hiddenProps = hiddenProps.concat(['__v', '_id']);
    var fieldDescriptions = aMongooseModel.getFieldDescriptions && aMongooseModel.getFieldDescriptions() || {};


    function addEmbeddedDocProps(parentType, targetModel) {
        var subModelName;
        _.forOwn(parentType, function (property, propertyName) {

                if (isReference(property.type)) {
                    targetModel.properties[propertyName] = {$ref: property.ref || property.type.name};
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
        return (type && type.name === 'ObjectId') || (type && type.type && type.type.name === 'ObjectId');
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
        if (propertyName.indexOf('I18n') !== -1) {
            return 'I18nString';
        } else {
            return _.last(propertyName) === 's' && !dontDepluralize ?
                propertyName.charAt(0).toUpperCase() + propertyName.slice(1, -1)
                : propertyName.charAt(0).toUpperCase() + propertyName.slice(1);
        }
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
                } else if (isReference(type)) {
                    realTargetModel.properties[realPropertyName] = {$ref: path.options.ref};
                } else {
                    realTargetModel.properties[realPropertyName] = {
                        type: typeMap[path.constructor.name] || typeMap[path.options.type.name] || path.options.type.name
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

    addModelPaths(aMongooseModel.schema.paths, aMongooseModel.schema.nested, mainModel);

    return swaggerModels;
}


module.exports = {
    getSwaggerModel: getSwaggerModel
};
