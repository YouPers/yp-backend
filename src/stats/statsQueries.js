var mongoose = require('ypbackendlib').mongoose,
    ObjectId = mongoose.Types.ObjectId,
    transformers = require('./transformers');

module.exports = {
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
                transformers: transformers.replaceIds
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
            transformers: transformers.replaceIds
        },
        activitiesPlannedPerDay:{
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
                }]},
        activityEvents: {
            modelName: 'ActivityEvent',
            stages: [{
                $project: {
                    status: {$cond: [{$gt: ['$end', new Date()]}, 'future', '$status']}
                }
            },
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
                }]
        },
        eventsStatusAvg: {
            modelName: 'ActivityEvent',
            stages: []
        },
        eventsRatings: {
            modelName: 'ActivityEvent',
            stages: [{
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
                }]
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
                }]},
        eventsDonePerDay: {
            modelName: 'ActivityEvent',
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
                }]},
        usersTotal: {
            modelName: 'AssessmentResult',
            stages: [{
                $project: {
                    campaign: 1
                }
            },
                {
                    $group: {
                        _id: 'Total',
                        usersTotal: {$sum: 1}
                    }
                },
                {
                    $project: {
                        usersTotal: 1,
                        _id: 0
                    }
                }]},
        newUsersPerDay: {
            modelName: 'AssessmentResult',
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

