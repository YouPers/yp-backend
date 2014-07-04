var mongoose = require('mongoose'),
    moment = require('moment'),
    ObjectId = mongoose.Types.ObjectId;

var statsQueries = function (timeRange, scopeType, scopeId) {
    if (!scopeType) {
        scopeType = 'all';
    }
    // scope can be 'owner', 'campaign', 'all'
    var scopePipelineEntry = null;

    if ((scopeType === 'owner') || (scopeType === 'campaign')) {
        if (!scopeId) {
            throw new Error("Illegal Arguments, when ScopeType == campaign or owner, an id has to be passed");
        }
        scopePipelineEntry = { $match: {}};
        scopePipelineEntry.$match[scopeType] = new ObjectId(scopeId);
    }

    var timeRangePipelineEntry = null;
    if (timeRange && (timeRange !== 'all')) {
        timeRangePipelineEntry = {$match: {'start': {$gt: moment().startOf(timeRange).toDate(), $lt: moment().endOf(timeRange).toDate()}}};
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
                year: {$year: '$created'},
                month: {$month: '$created'},
                day: {$dayOfMonth: '$created'}
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

    ///////////////////////////////////////
    // AssessmentUpdates Total
    var assUpdatesTotalQuery = mongoose.model('AssessmentResult').aggregate();
    if (scopePipelineEntry) {
        assUpdatesTotalQuery.append(scopePipelineEntry);
    }
    assUpdatesTotalQuery.append(
        {
            $group: {
                _id: 'Total',
                updatesTotal: {$sum: 1}
            }
        },
        {$project: {
            _id: 0,
            updatesTotal: 1
        }}
    );

    /////////////////////////////////////////
    // Assessment Totals per Day
    var assessmentTotalsQuery = mongoose.model('AssessmentResult').aggregate();
    if (scopePipelineEntry) {
        assessmentTotalsQuery.append(scopePipelineEntry);
    }
    assessmentTotalsQuery.append(
        {$sort: {created: -1}},
        {$group: {
            _id: '$owner',
            newestAnswer: {$first: '$answers'}
        }},
        {$unwind: '$newestAnswer'},
        {$match: {'newestAnswer.question': new ObjectId('5278c51a6166f2de240000df')}},
        {$group: {
            _id: null,
            totalAssessments: {$sum: 1},
            avgStress: {$avg: '$newestAnswer.answer'}
        }},
        {$project: {
            _id: 0,
            totalAssessments: 1,
            avgStress: 1}
        });

    //////////////////////////////////////
    // topStressors
    var topStressorsQuery = mongoose.model('AssessmentResult').aggregate();
    if (scopePipelineEntry) {
        topStressorsQuery.append(scopePipelineEntry);
    }
    topStressorsQuery.append(
        {$sort: {created: -1}},
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
    var actsPlannedQuery = mongoose.model('Activity').aggregate();
    if (scopePipelineEntry) {
        actsPlannedQuery.append(scopePipelineEntry);
    }
    actsPlannedQuery.append(
        {$group: {
            _id: '$idea',
            count: {$sum: 1}
        }},
        {$sort: {count: -1}},
        {$project: {
            idea: '$_id',
            _id: 0,
            count: 1
        }});

    ///////////////////////////////////////////////////
    // activitiesPlanned Total
    var actsPlannedTotalQuery = mongoose.model('Activity').aggregate();
    if (scopePipelineEntry) {
        actsPlannedTotalQuery.append(scopePipelineEntry);
    }
    actsPlannedTotalQuery.append(
        {$group: {
            _id: 'Total',
            activitiesPlannedTotal: {$sum: 1}
        }},
        {$project: {
            _id: 0,
            activitiesPlannedTotal: 1
        }});

    /////////////////////////////////////////////////////
    // ActivityEvents
    var eventsQuery = mongoose.model('ActivityEvent').aggregate();
    if (scopePipelineEntry) {
        eventsQuery.append(scopePipelineEntry);
    }
    if (timeRangePipelineEntry) {
        eventsQuery.append(timeRangePipelineEntry);
    }
    eventsQuery.append(
        {   $project: {
            status: {$cond: [{$gt: ['$end', new Date()]},'future', '$status']}
        }},
        {$group: {
            _id: '$status',
            count: {$sum: 1}
        }},
        {$project: {
            status: '$_id',
            count: 1,
            _id: 0
        }}
    );

    /////////////////////////////////////////////////////
    // ActivityEvents Total
    var eventsTotalQuery = mongoose.model('Activity').aggregate();
    if (scopePipelineEntry) {
        eventsTotalQuery.append(scopePipelineEntry);
    }
    eventsTotalQuery.append(
        {$unwind: '$events'}
    );
    if (timeRangePipelineEntry) {
        eventsTotalQuery.append(timeRangePipelineEntry);
    }
    eventsTotalQuery.append(
        {$project: {
            events: 1
        }},
        {$group: {
            _id: 'Total',
            eventsTotal: {$sum: 1}
        }},
        {$project: {
            eventsTotal: 1,
            _id: 0
        }}
    );

    /////////////////////////////////////////////////////
    // Users Total
    var usersTotalQuery = mongoose.model('User').aggregate();
    if (scopePipelineEntry) {
        usersTotalQuery.append(scopePipelineEntry);
    }
    if (timeRangePipelineEntry) {
        usersTotalQuery.append(timeRangePipelineEntry);
    }
    usersTotalQuery.append(
        {$project: {
            campaign: 1
        }},
        {$group: {
            _id: 'Total',
            usersTotal: {$sum: 1}
        }},
        {$project: {
            usersTotal: 1,
            _id: 0
        }}
    );

    var focusSetQuery = mongoose.model('Profile').aggregate();
    if (scopePipelineEntry) {
        focusSetQuery.append(scopePipelineEntry);
    }
    if (timeRangePipelineEntry) {
        focusSetQuery.append(timeRangePipelineEntry);
    }
    focusSetQuery.append(
        {$match: {focus: {$ne: []}}},
        {$group: {_id: 'total',
                  users: {$sum: 1}}
        },
        {$project: {
            users: 1,
            _id: 0
        }}
    );

    var usersWithDiaryEntryQuery = mongoose.model('Profile').aggregate();
    if (scopePipelineEntry) {
        usersWithDiaryEntryQuery.append(scopePipelineEntry);
    }
    if (timeRangePipelineEntry) {
        usersWithDiaryEntryQuery.append(timeRangePipelineEntry);
    }
    usersWithDiaryEntryQuery.append(
        {$match: {lastDiaryEntry: {$ne: ''}}},
        {$group: {_id: 'total',
            users: {$sum: 1}}
        },
        {$project: {
            users: 1,
            _id: 0
        }}
    );

    return {
        assUpdatesPerDay: assUpdatesPerDayQuery,
        assUpdatesTotal: assUpdatesTotalQuery,
        assTotals: assessmentTotalsQuery,
        topStressors: topStressorsQuery,
        activitiesPlanned: actsPlannedQuery,
        activitiesPlannedTotal: actsPlannedTotalQuery,
        activityEvents: eventsQuery,
        activityEventsTotal: eventsTotalQuery,
        usersTotal: usersTotalQuery,
        focusSet: focusSetQuery,
        usersWithDiaryEntry: usersWithDiaryEntryQuery
        };
};



module.exports = {
    queries: statsQueries};