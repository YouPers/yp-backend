var transformers = require('./transformers'),
    _ = require('lodash'),
    stats = require('ypbackendlib').stats;

// reused Aggregation piplines for multiple queries
var _occurencesStages = [
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
    eventsPlanned: {
        modelName: 'Event',
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
    eventsPlannedPerDay: {
        modelName: 'Event',
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
    eventsPlannedTotal: {
        modelName: 'Event',
        stages: [{
            $group: {
                _id: 'Total',
                eventsPlannedTotal: {$sum: 1}
            }
        },
            {
                $project: {
                    _id: 0,
                    eventsPlannedTotal: 1
                }
            }]
    },
    occurencesStatus: {
        modelName: 'Occurence',
        stages: _occurencesStages
    },
    occurencesStatusAvg: {
        modelName: 'Occurence',
        stages: _occurencesStages,
        transformers: transformers.divideCountAttrByUserCount
    },
    occurencesRatings: {
        modelName: 'Occurence',
        stages: _eventRatingsStages,
        transformers: transformers.addPercentagesOfRatingsCount
    },
    occurencesPlanned: {
        modelName: 'Occurence',
        stages: [
            {$group: {
                _id: {
                    owner: '$owner',
                    idea: '$idea'
                },
                count: {$sum: 1}


            }},
            {$group: {
                _id: '$_id.idea',
                plannedCount: {
                    $sum: '$count'
                },
                byUsersCount: {
                    $sum: 1
                }
            }},
            {$sort: {plannedCount: -1}}
        ],
        transformers: transformers.replaceIds('Idea')
    },
    occurencesTotal: {
        modelName: 'Occurence',
        stages: [{
            $group: {
                _id: 'Total',
                occurencesTotal: {$sum: 1}
            }
        },
            {
                $project: {
                    occurencesTotal: 1,
                    _id: 0
                }
            }]
    },
    occurencesDonePerDay: {
        modelName: 'Occurence',
        stages: [{
            $project: {
                date: {
                    year: {$year: '$updated'},
                    month: {$month: '$updated'},
                    day: {$dayOfMonth: '$updated'}
                },
                status: '$status'
            }
        },
            {
                $group: {
                    _id: '$date',
                    Done: {$sum: {$cond: {if: {$eq: ['$status', 'done']}, then: 1, else: 0}}},
                    Missed: {$sum: {$cond: {if: {$eq: ['$status', 'missed']}, then: 1, else: 0}}}
                }
            },
            {
                $project: {
                    date: '$_id',
                    _id: 0,
                    Done: 1,
                    Missed: 1
                }
            }]
    },
    usersTotal: {
        modelName: 'User',
        ignoreScope: true,
        stages: [
            {
                $group: {
                    _id: '$campaign',
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
        transformers: function(objs, options, cb) {
            var nrOfCampaigns = objs.length - 1; // -1 because of the "null" value (users without campaign)
            var myCampaignId = options.scopeId;

            var totalNrOfUsers = _.reduce(objs, function(sum, obj) {
                if (obj.campaign) {
                    return sum + obj.usersTotal;
                } else {
                    return sum;
                }

            }, 0);

            if (myCampaignId) {
                var myCampaignTotal = _.find(objs, function(obj) {
                    return obj.campaign && obj.campaign.equals(myCampaignId);
                });

                return cb(null, {
                    usersTotal: myCampaignTotal && myCampaignTotal.usersTotal || 0,
                    usersAvg: totalNrOfUsers / nrOfCampaigns
                }, options);
            } else {
                return cb(null,{
                    count: totalNrOfUsers
                }, options);
            }
        }
    },
    newUsersPerDay: {
        modelName: 'User',
        stages: [{
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
            {$sort: {'date.year': -1, 'date.month': -1, 'date.day': -1}}]
    }
};

stats.registerQueries(queries);