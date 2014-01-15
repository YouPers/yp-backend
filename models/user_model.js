/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId,
    crypto = require('crypto'),
    restify = require('restify'),
    common = require('./common');
/**
 * User Schema
 */
var UserSchema = common.newSchema({
    firstname: { type: String, trim: true, required: true },
    lastname: { type: String, trim: true, required: true },
    fullname: { type: String, trim: true, required: true },
    email: { type: String, trim: true, lowercase: true, required: true, unique: true },
    avatar: {type: String},
    emailValidatedFlag: { type: Boolean, default: false },
    username: { type: String, trim: true, lowercase: true, required: true, unique: true },
    roles: [{ type: String}],
    hashed_password: { type: String, trim: true },
    tempPasswordFlag: { type: Boolean, default: false },
    preferences: {
        starredActivities: [
            {type: ObjectId, ref: 'Activity'}
        ],
        workingDays: [
            {type: String}
        ]
    }
});

/**
 * Methods
 */

UserSchema.methods = {

    /**
     * Encrypt password
     *
     * @param {String} password
     * @return {String}
     * @api public
     */
    encryptPassword: function (password) {
        if (!password || !this._id) {
            return '';
        }
        return crypto.createHmac('sha1', this._id.toString()).update(password).digest('hex'); // using the ObjectId as the salt
    },

    validPassword: function (password) {
        return crypto.createHmac('sha1', this._id.toString()).update(password).digest('hex') === this.hashed_password;
    }
};


/**
 * helper functions
 */
var validatePresenceOf = function (value) {
    return value && value.length;
};

/**
 * Virtuals
 */

UserSchema.virtual('password_old')
    .set(function (password_old) {
        this._password_old = password_old;
    })
    .get(function() {
        return this._password_old;
    });

UserSchema
    .virtual('password')
    .set(function (password) {
        this._password = password;
    })
    .get(function () {
        return this._password;
    });

UserSchema.statics.toJsonConfig = function () {
    return {
        hide: ['hashed_password', 'tempPasswordFlag', 'emailValidatedFlag']
    };
};

/**
 * Pre-save hook
 */
UserSchema.pre('save', function (next) {
    if (!validatePresenceOf(this.username)) {
        next(new restify.MissingParameterError('username cannot be blank'));
    }
    if (!validatePresenceOf(this.roles)) {
        next(new restify.MissingParameterError('roles cannot be blank'));
    }
    if (!validatePresenceOf(this.email)) {
        next(new restify.MissingParameterError('email cannot be blank'));
    }
    if (this.email.indexOf('@') <= 0) {
//    next(new restify.MissingParameterError('Email address must be valid'));
    }


    if(!this.hashed_password || (this.password_old && this.hashed_password === this.encryptPassword(this.password_old))) {
        this.hashed_password = this.encryptPassword(this.password);
    } else if(this.password_old) {
        next(new restify.InvalidArgumentError('Invalid password'));
    }


    // password not blank when creating, otherwise skip
    if (!this.isNew) {
        return next();
    }
    if (!validatePresenceOf(this.password)) {
        next(new restify.MissingParameterError('Invalid password'));
    }
    next();
});


module.exports = mongoose.model('User', UserSchema);

common.initializeDbFor(mongoose.model('User'));