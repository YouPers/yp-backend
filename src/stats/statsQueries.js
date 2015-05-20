var mongoose = require('ypbackendlib').mongoose,
    ObjectId = mongoose.Types.ObjectId,
    transformers = require('./transformers'),
    _ = require('lodash'),
    stats = require('ypbackendlib').stats;

// reused Aggregation piplines for multiple queries
var _activityEventsStages = [
    // does not work reliably, don't know why. Instead of producing totally wrong stats we just
    // count the future ones as open, this is much better: see WL-1506
    //{
    //    $project: {
    //        status: {$cond: [{$gt: ['$end', new Date()]}, 'future', '$status']}
    //    }
    //},
    {
        $group: {
            _id: '$status',
            count: {$sum: 1}
        }
    },
    {
        $project: {
            status: '$_id',
            count: 1,
            _id: 0
        }
    }];


var _eventRatingsStages = [
    {
        $group: {
            _id: '$feedback',
            count: {$sum: 1}
        }
    },
    {
        $project: {
            rating: '$_id',
            count: 1,
            _id: 0
        }
    }];


///////////////////////////
// our queryDefinitions

var queries = {
    assUpdatesPerDay: {
        modelName: 'AssessmentResult',
        stages: [
            {
                $project: {
                    date: {
                        year: {$year: '$created'},
                        month: {$month: '$created'},
                        day: {$dayOfMonth: '$created'}
                    }
                }
            },
            {
                $group: {
                    _id: '$date',
                    count: {$sum: 1}
                }
            },
            {
                $project: {
                    date: '$_id',
                    _id: 0,
                    count: 1
                }
            },
            {$sort: {'date.year': -1, 'date.month': -1, 'date.day': -1}}
        ]
    },
    assUpdatesTotal: {
        modelName: 'AssessmentResult',
        stages: [
            {
                $group: {
                    _id: 'Total',
                    updatesTotal: {$sum: 1}
                }
            },
            {
                $project: {
                    _id: 0,
                    updatesTotal: 1
                }
            }
        ]
    },
    assTotals: {
        modelName: 'AssessmentResult',
        stages: [
            {$sort: {created: -1}},
            {
                $group: {
                    _id: '$owner',
                    newestAnswer: {$first: '$answers'}
                }
            },
            {$unwind: '$newestAnswer'},
            {$match: {'newestAnswer.question': new ObjectId('5278c51a6166f2de240000df')}},
            {
                $group: {
                    _id: null,
                    totalAssessments: {$sum: 1},
                    avgStress: {$avg: '$newestAnswer.answer'}
                }
            },
            {
                $project: {
                    _id: 0,
                    totalAssessments: 1,
                    avgStress: 1
                }
            }]
    },
    needForAction: {
        modelName: 'AssessmentResult',
        stages: [
            {$sort: {created: -1}},
            {
                $group: {
                    _id: '$owner',
                    nfa: {$first: '$needForAction'}
                }
            },
            {$unwind: '$nfa'},
            {
                $group: {
                    _id: '$nfa.category',
                    avg: {$avg: '$nfa.value'}
                }
            },
            {
                $project: {
                    _id: 0,
                    category: '$_id',
                    avg: 1
                }
            }
        ]
    },

    assessmentResults: {
        modelName: 'AssessmentResult',
        stages: [
            {$sort: {created: -1}},
            {
                $group: {
                    _id: '$owner',
                    newestAnswer: {$first: '$answers'}
                }
            },
            {$unwind: '$newestAnswer'},
            {
                $project: {
                    question: '$newestAnswer.question',
                    veryPos: {
                        $cond: [
                            {$gt: ['$newestAnswer.answer', 50]},
                            1,
                            0
                        ]
                    },
                    pos: {
                        $cond: [
                            {$and: [{$gt: ['$newestAnswer.answer', 1]}, {$lt: ['$newestAnswer.answer', 51]}]},
                            1,
                            0
                        ]
                    },
                    veryNeg: {
                        $cond: [
                            {$lt: ['$newestAnswer.answer', -50]},
                            1,
                            0
                        ]
                    },
                    neg: {
                        $cond: [
                            {$and: [{$lt: ['$newestAnswer.answer', 0]}, {$gt: ['$newestAnswer.answer', -51]}]},
                            1,
                            0
                        ]
                    },
                    zero: {
                        $cond: [
                            {$eq: ['$newestAnswer.answer', 0]},
                            1,
                            0
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: '$question',
                    veryPos: {$sum: '$veryPos'},
                    pos: {$sum: '$pos'},
                    zero: {$sum: '$zero'},
                    neg: {$sum: '$neg'},
                    veryNeg: {$sum: '$veryNeg'},
                    count: {$sum: 1}
                }
            },
            {
                $project: {
                    question: '$_id',
                    veryPos: {$divide: ['$veryPos', '$count']},
                    pos: {$divide: ['$pos', '$count']},
                    zero: {$divide: ['$zero', '$count']},
                    neg: {$divide: ['$neg', '$count']},
                    veryNeg: {$divide: ['$veryNeg', '$count']},
                    count: 1,
                    _id: 0
                }
            }],
        transformers: transformers.replaceIds('AssessmentQuestion')
    },
    topStressors: {
        modelName: 'AssessmentResult',
        stages: [
            {$sort: {created: -1}},
            {
                $group: {
                    _id: '$owner',
                    newestAnswer: {$first: '$answers'}
                }
            },
            {$unwind: '$newestAnswer'},
            {
                $project: {
                    question: '$newestAnswer.question',
                    posAnswer: {
                        $cond: [
                            {$gt: ['$newestAnswer.answer', 0]},
                            '$newestAnswer.answer',
                            0
                        ]
                    },
                    negAnswer: {
                        $cond: [
                            {$lt: ['$newestAnswer.answer', 0]},
                            {$multiply: ['$newestAnswer.answer', -1]},
                            0
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: '$question',
                    posAvg: {$avg: '$posAnswer'},
                    negAvg: {$avg: '$negAnswer'},
                    count: {$sum: 1}
                }
            },
            {
                $project: {
                    question: '$_id',
                    _id: 0,
                    posAvg: 1,
                    negAvg: 1,
                    sumAvg: {$add: ['$posAvg', '$negAvg']},
                    count: 1
                }
            },
            {$sort: {sumAvg: -1}},
            {$limit: 3}],
        transformers: transformers.replaceIds('AssessmentQuestion')
    },
    activitiesPlanned: {
        modelName: 'Activity',
        stages: [{
            $group: {
                _id: '$idea',
                count: {$sum: 1}
            }
        },
            {$sort: {count: -1}},
            {
                $project: {
                    idea: '$_id',
                    _id: 0,
                    count: 1
                }
            }],
        transformers: transformers.replaceIds('Idea')
    },
    activitiesPlannedPerDay: {
        modelName: 'Activity',
        stages: [{
            $project: {
                date: {
                    year: {$year: '$created'},
                    month: {$month: '$created'},
                    day: {$dayOfMonth: '$created'}
                },
                joiningUsers: '$joiningUsers'
            }
        },
            {
                $group: {
                    _id: '$date',
                    count: {$sum: {$add: [1, {$size: '$joiningUsers'}]}}
                }
            },
            {
                $project: {
                    date: '$_id',
                    _id: 0,
                    count: 1
                }
            },
            {$sort: {'date.year': -1, 'date.month': -1, 'date.day': -1}}
        ]
    },
    activitiesPlannedTotal: {
        modelName: 'Activity',
        stages: [{
            $group: {
                _id: 'Total',
                activitiesPlannedTotal: {$sum: 1}
            }
        },
            {
                $project: {
                    _id: 0,
                    activitiesPlannedTotal: 1
                }
            }]
    },
    eventsStatus: {
        modelName: 'ActivityEvent',
        stages: _activityEventsStages
    },
    eventsStatusAvg: {
        modelName: 'ActivityEvent',
        stages: _activityEventsStages,
        transformers: transformers.divideCountAttrByUserCount
    },
    eventsRatings: {
        modelName: 'ActivityEvent',
        stages: _eventRatingsStages,
        transformers: transformers.addPercentagesOfRatingsCount
    },
    eventsPlanned: {
        modelName: 'ActivityEvent',
        stages: [
            {
                $group: {
                    _id: {
                        owner: '$owner',
                        idea: '$idea'
                    },
                    count: {$sum: 1}


                }
            },
            {
                $group: {
                    _id: '$_id.idea',
                    plannedCount: {
                        $sum: '$count'
                    },
                    byUsersCount: {
                        $sum: 1
                    }
                }
            },
            {$sort: {plannedCount: -1}}
        ],
        transformers: transformers.replaceIds('Idea')
    },
    activityEventsTotal: {
        modelName: 'ActivityEvent',
        stages: [{
            $group: {
                _id: 'Total',
                eventsTotal: {$sum: 1}
            }
        },
            {
                $project: {
                    eventsTotal: 1,
                    _id: 0
                }
            }]
    },
    eventsDonePerDay: {
        modelName: 'ActivityEvent',
        stages: [{
            $project: {
                date: {
                    year: {$year: '$start'},
                    month: {$month: '$start'},
                    day: {$dayOfMonth: '$start'}
                },
                status: '$status'
            }
        },
            {
                $group: {
                    _id: '$date',
                    Done: {$sum: {$cond: {if: {$eq: ['$status', 'done']}, then: 1, else: 0}}},
                    Missed: {$sum: {$cond: {if: {$eq: ['$status', 'missed']}, then: 1, else: 0}}},
                    Open: {$sum: {$cond: {if: {$eq: ['$status', 'open']}, then: 1, else: 0}}}
                }
            },
            {
                $project: {
                    date: '$_id',
                    _id: 0,
                    Done: 1,
                    Missed: 1,
                    Open: 1
                }
            }]
    },
    newestPlans: {
        modelName: 'ActivityEvent',
        stages: [
            {
                $group: {
                    _id: '$idea',
                    count: {$sum: 1},
                    newest: {$max: '$created'}
                }
            },
            {
                $sort: {'newest': -1}
            },
            {
                $project: {
                    idea: '$_id',
                    _id: 0,
                    count: 1,
                    planned: '$newest'
                }
            }]
    },
    usersTotal: {
        modelName: 'User',
        ignoreScope: true,
        stages: [
            {
                $unwind: "$allCampaigns"
            },
            {
                $group: {
                    _id: '$allCampaigns.campaign',
                    usersTotal: {$sum: 1}
                }
            },
            {
                $project: {
                    usersTotal: 1,
                    campaign: '$_id',
                    _id: 0
                }
            }],
        transformers: function (objs, options, cb) {

            var containsNullCampaign = _.any(objs, function(obj) {
                return _.isNull(obj.campaign) || _.isUndefined(obj.campaign);
            });

            var nrOfCampaigns =  objs.length;
            if (containsNullCampaign) {
                nrOfCampaigns--;
            }
            var myCampaignId = options.scopeId;

            var totalNrOfUsers = _.reduce(objs, function (sum, obj) {
                if (obj.campaign) {
                    return sum + obj.usersTotal;
                } else {
                    return sum;
                }

            }, 0);

            if (myCampaignId) {
                var myCampaignTotal = _.find(objs, function (obj) {
                    return obj.campaign && obj.campaign.equals(myCampaignId);
                });

                return cb(null, {
                    usersTotal: myCampaignTotal && myCampaignTotal.usersTotal || 0,
                    usersAvg: totalNrOfUsers / nrOfCampaigns
                }, options);
            } else {
                return cb(null, {
                    count: totalNrOfUsers
                }, options);
            }
        }
    },
    newUsersPerDay: {
        modelName: 'User',
        stages: [
            {
                $unwind: "$allCampaigns"
            },
            {
                $project: {
                    date: {
                        year: {$year: '$allCampaigns.joined'},
                        month: {$month: '$allCampaigns.joined'},
                        day: {$dayOfMonth: '$allCampaigns.joined'}
                    }
                }
            },
            {
                $group: {
                    _id: '$date',
                    count: {$sum: 1}
                }
            },
            {
                $project: {
                    date: '$_id',
                    _id: 0,
                    count: 1
                }
            },
            {$sort: {'date.year': -1, 'date.month': -1, 'date.day': -1}}]
    },
    usersPerCampaign: {
        modelName: 'User',
        ignoreScope: true,
        stages: [
            {
                $unwind: "$allCampaigns"
            },
            {
                $group: {
                    _id: '$allCampaigns.campaign',
                    usersTotal: {$sum: 1}
                }
            },
            {
                $project: {
                    usersTotal: 1,
                    campaign: '$_id',
                    _id: 0
                }
            }]
    }
};

stats.registerQueries(queries);