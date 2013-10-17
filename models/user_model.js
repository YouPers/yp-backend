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
var UserSchema = new Schema({
    firstname: { type: String, trim: true, required: true },
    lastname: { type: String, trim: true, required: true },
    fullname: { type: String, trim: true, required: true },
    email: { type: String, trim: true, lowercase: true, required: true, unique: true },
    emailValidatedFlag: { type: Boolean, default: false },
    username: { type: String, trim: true, lowercase: true, required: true, unique: true },
    role: { type: String, enum: ['individual', 'healthpromoter', 'admin'], default: 'individual', required: true },
    hashed_password: { type: String, trim: true },
    tempPasswordFlag: { type: Boolean, default: false }
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
UserSchema
    .virtual('password')
    .set(function (password) {
        this._password = password;
        this.hashed_password = this.encryptPassword(password);
    })
    .get(function () {
        return this._password;
    });

/**
 * Pre-save hook
 */
UserSchema.pre('save', function (next) {
    if (!validatePresenceOf(this.username)) {
        next(new restify.MissingParameterError('Username cannot be blank'));
    }
    if (!validatePresenceOf(this.role)) {
        next(new restify.MissingParameterError('Role cannot be blank'));
    }
    if (!validatePresenceOf(this.email)) {
        next(new restify.MissingParameterError('Email cannot be blank'));
    }
    if (this.email.indexOf('@') <= 0) {
//    next(new restify.MissingParameterError('Email address must be valid'));
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


mongoose.model('User', UserSchema);

common.initializeDbFor(mongoose.model('User'));