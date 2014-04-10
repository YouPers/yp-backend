var mongoose = require('mongoose'),
    DiaryEntry = mongoose.model('DiaryEntry'),
    error = require('../util/error'),
    _ = require('lodash');

function createOrUpdateDiaryEntry (entryToStore, cb) {

    DiaryEntry
        .find({refId: entryToStore.refId})
        .exec(function(err, entries) {
            if (err) {
                error.handleError(err, cb);
            }

            if (entries.length === 0) {
                var newEntry = new DiaryEntry(entryToStore);
                return newEntry.save(cb);
            } else if (entries.length ===1) {
                _.merge(entries[0], entryToStore);
                return entries[0].save(cb);
            } else {
                cb(new Error('should never find more than one diaryEntry for one refId'));
            }
        });
}

module.exports = {
    createOrUpdateDiaryEntry: createOrUpdateDiaryEntry
};
