/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId,
    crypto = require('crypto'),
    common = require('./common'),
    error = require('../util/error'),
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
    roles: {type: [String], select: false},
    hashed_password: { type: String, trim: true, select: false },
    tempPasswordFlag: { type: Boolean, default: false, select: false },
    campaign: {type: ObjectId, ref: 'Campaign', select: false},
    profile: {type: ObjectId, ref: 'Profile', select: false}
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
    },

    getPersonalNotificationQueues: function() {
        // the personal _id of the user for personal messages
        var queues =  [this._id];

        // add the campaign _id to get Notifications from the camapaign commuinity
        if (this.campaign) {
            queues.push(this.campaign._id || this.campaign);
        }

        // add special queues the user has subscribed to
        if (this.profile && this.profile.notificationQueues) {
            queues = queues.concat(this.profile.notificationQueues);
        }
        return queues;
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
        next(new error.MissingParameterError({ required: 'username' }));
    }
    if (!validatePresenceOf(this.roles)) {
        next(new error.MissingParameterError({ required: 'roles' }));
    }
    if (!validatePresenceOf(this.email)) {
        next(new error.MissingParameterError({ required: 'email' }));
    }
    if (this.email.indexOf('@') <= 0) {
//    next(new restify.MissingParameterError('Email address must be valid'));
    }


    if(!this.hashed_password || (this.password_old && this.hashed_password === this.encryptPassword(this.password_old))) {
        this.hashed_password = this.encryptPassword(this.password);
    } else if(this.password_old) {
        next(new error.InvalidArgumentError('Invalid password.'));
    }

    if (!this.isNew || this.profile) {
        if (this.campaign && (this.campaign !== this.profile.campaign )) {
            Profile.update({_id: this.profile}, {campaign: this.campaign}).exec(function(err){
                if (err) {
                    return error.handleError(err, next);
                }
                return next();
            });
        } else {
            return next();
        }
    } else {
        // generate and store new profile id into new user object
        var newProfileId = mongoose.Types.ObjectId();
        this.profile = newProfileId;

        var newProfile = new Profile( { _id: newProfileId, owner: this.id, timestamp: new Date(), campaign: this.campaign } );

        newProfile.save(function (err) {
            if (err) {
                return error.handleError(err, next);
            }
        });
        if (!validatePresenceOf(this.password)) {
            next(new error.MissingParameterError({ required: 'password' }));
        }
        if (!this.avatar) {
            this.avatar = this.profile.gender === 'male' ? '/assets/img/avatar_man.png' : '/assets/img/avatar_woman.png';
        }
        next();

    }
});

UserSchema.pre('remove', function (next) {

    var profileId = this.profile;

    var profile = Profile.find( { _id: profileId } );

    profile.remove(function (err) {
        if (err) {
            return error.handleError(err, next);
        }
    });

    next();
});

module.exports = mongoose.model('User', UserSchema);
