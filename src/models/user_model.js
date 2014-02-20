/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId,
    crypto = require('crypto'),
    restify = require('restify'),
    common = require('./common'),
    Profile = mongoose.model('Profile');
/**
 * User Schema
 */
var UserSchema = common.newSchema({
    firstname: { type: String, trim: true, required: true },
    lastname: { type: String, trim: true, required: true },
    fullname: { type: String, trim: true, required: true },
    email: { type: String, trim: true, lowercase: true, required: true, unique: true, select: false},
    avatar: {type: String},
    emailValidatedFlag: { type: Boolean, default: false, select: false },
    username: { type: String, trim: true, lowercase: true, required: true, unique: true, select:false },
    roles: {type: [{ type: String}], select: false},
    hashed_password: { type: String, trim: true, select: false },
    tempPasswordFlag: { type: Boolean, default: false, select: false },
    campaign: {type: ObjectId, ref: 'Campaign', select: false},
    profile: {type: ObjectId, ref: 'Profile', select: false},
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
    },
    toJsonConfig: {
        hide: ['hashed_password', 'tempPasswordFlag']
    }
};

UserSchema.statics.privatePropertiesSelector = '+email +roles +emailValidatedFlag +hashed_password +tempPasswordFlag +profile +username +campaign';
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

    if (!this.isNew || this.profile) {
        return next();
    } else {
        // generate and store new profile id into new user object
        var newProfileId = mongoose.Types.ObjectId();
        this.profile = newProfileId;

        var newProfile = new Profile( { _id: newProfileId, owner: this.id, timestamp: new Date() } );

        newProfile.save(function (err) {
            if (err) {
                err.statusCode = 409;
                return next(err);
            }
        });

    }
    if (!validatePresenceOf(this.password)) {
        next(new restify.MissingParameterError('Invalid password'));
    }
    next();
});

UserSchema.pre('remove', function (next) {

        var profileId = this.profile;

    var profile = Profile.find( { _id: profileId } );

    profile.remove(function (err) {
        if (err) {
            return next(err);
        }
    });

    next();
});


module.exports = mongoose.model('User', UserSchema);

common.initializeDbFor(mongoose.model('User'));