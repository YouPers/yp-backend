var events = require('events'),
    mongoose = require('mongoose'),
    util = require('util'),
    moment = require('moment'),
    ObjectId = mongoose.Types.ObjectId;


var statsUpdaterInstance = new events.EventEmitter();

statsUpdaterInstance.update = function (event, newValue, oldValue, newContext) {
    var self = this;
    process.nextTick(function () {
            self.emit(event, newValue, oldValue, newContext);
        }
    );
};

var statsQueries = function (timeRange, scopeType, scopeId) {
    if (!scopeType) {
        scopeType = 'all';
    }
    // scope can be 'owner', 'campaign', 'all'
    var scopePipelineEntry = null;

    if ((scopeType === 'owner') || (scopeType === 'campaign')) {
        if (!scopeId) {
            throw new Error("Illegal Arguments, when ScopeType == campaign or owner, a id has to be passed");
        }
        scopePipelineEntry = { $match: {}};
        scopePipelineEntry.$match[scopeType] = scopeId;
    }

    var timeRangePipelineEntry = null;
    if (timeRange && (timeRange !== 'all')) {
        timeRangePipelineEntry = {$match: {'events.begin': {$gt: moment().startOf(timeRange).toDate(), $lt: moment().endOf(timeRange).toDate()}}};
    }

    ///////////////////////////////////////
    // AssessmentUpdates per Day
    var assUpdatesPerDayQuery = mongoose.model('AssessmentResult').aggregate();
    if (scopePipelineEntry) {
        assUpdatesPerDayQuery.append(scopePipelineEntry);
    }
    assUpdatesPerDayQuery.append(
        { $project: {
            date: {
                year: {$year: '$timestamp'},
                month: {$month: '$timestamp'},
                day: {$dayOfMonth: '$timestamp'}
            },
            owner: '$owner'
        }
        },
        {
            $group: {
                _id: '$date',
                updatesPerDay: {$sum: 1}
            }
        },
        {$project: {
            date: '$_id',
            _id: 0,
            updatesPerDay: 1
        }}
    );

    /////////////////////////////////////////
    // AssessmentTotals
    var assessmentTotalsQuery = mongoose.model('AssessmentResult').aggregate();
    if (scopePipelineEntry) {
        assessmentTotalsQuery.append(scopePipelineEntry);
    }
    assessmentTotalsQuery.append(
        {$sort: {timestamp: -1}},
        {$group: {
            _id: '$owner',
            newestAnswer: {$first: '$answers'}
        }},
        {$unwind: '$newestAnswer'},
        {$match: {'newestAnswer.question': new ObjectId('5278c51a6166f2de240000df')}},
        {$group: {
            _id: null,
            totalUsers: {$sum: 1},
            avgStress: {$avg: '$newestAnswer.answer'}
        }},
        {$project: {
            _id: 0,
            totalUsers: 1,
            avgStress: 1}
        });

    //////////////////////////////////////
    // topStressors
    var topStressorsQuery = mongoose.model('AssessmentResult').aggregate();
    if (scopePipelineEntry) {
        topStressorsQuery.append(scopePipelineEntry);
    }
    topStressorsQuery.append(
        {$sort: {timestamp: -1}},
        {$group: {
            _id: '$owner',
            newestAnswer: {$first: '$answers'}
        }},
        {$unwind: '$newestAnswer'},
        {$project: {
            question: '$newestAnswer.question',
            posAnswer: {$cond: [
                {$gt: ['$newestAnswer.answer', 0]},
                '$newestAnswer.answer',
                0
            ]},
            negAnswer: {$cond: [
                {$lt: ['$newestAnswer.answer', 0]},
                {$multiply: ['$newestAnswer.answer', -1]},
                0
            ]}
        }
        },
        {$group: {
            _id: '$question',
            posAvg: {$avg: '$posAnswer'},
            negAvg: {$avg: '$negAnswer'},
            count: {$sum: 1}
        }},
        {$project: {
            question: '$_id',
            _id: 0,
            posAvg: 1,
            negAvg: 1,
            sumAvg: {$add: ['$posAvg', '$negAvg']},
            count: 1
        }},
        {$sort: {sumAvg: -1}},
        {$limit: 3});


    ///////////////////////////////////////////////////
    // activitiesPlanned
    var actsPlannedQuery = mongoose.model('ActivityPlan').aggregate();
    if (scopePipelineEntry) {
        actsPlannedQuery.append(scopePipelineEntry);
    }
    actsPlannedQuery.append(
        {$group: {
            _id: '$activity',
            count: {$sum: 1}
        }},
        {$sort: {count: -1}},
        {$project: {
            activity: '$_id',
            _id: 0,
            count: 1
        }});

    /////////////////////////////////////////////////////
    // ActivityEvents
    var eventsQuery = mongoose.model('ActivityPlan').aggregate();
    if (scopePipelineEntry) {
        eventsQuery.append(scopePipelineEntry);
    }
    eventsQuery.append(
        {$unwind: '$events'},
        {$unwind: '$fields'}
    );
    if (timeRangePipelineEntry) {
        eventsQuery.append(timeRangePipelineEntry);
    }
    eventsQuery.append(
        {$project: {
            events: 1,
            fields: 1
        }},
        {$group: {
            _id: {status: '$events.status', field: '$fields'},
            count: {$sum: 1}
        }},
        {$project: {
            field: '$_id.field',
            status: '$_id.status',
            count: 1,
            _id: 0
        }}
    );

    return {
        assUpdatesPerDay: assUpdatesPerDayQuery,
        assTotals: assessmentTotalsQuery,
        topStressors: topStressorsQuery,
        activitiesPlanned: actsPlannedQuery,
        activityEvents: eventsQuery
        };
};

module.exports = {
    statsUpdater: statsUpdaterInstance,
    queries: statsQueries };