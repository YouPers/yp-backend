// fake calls to support the current graphics, need to be replaced with real data soon!


module.exports = function (app, config) {

    app.get("/activitystats", function (req, res, next) {

        if (req.params.range && (req.params.range === "today")) {
            res.send({"cols": [
                {"id": "actionCluster", "label": "Aktivitätsbereich", "type": "string"},
                {"id": "open-id", "label": "offen", "type": "number"},
                {"id": "done-id", "label": "durchgeführt", "type": "number"},
                {"id": "missed-id", "label": "verpasst", "type": "number"}
            ], "rows": [
                {"c": [
                    {"v": "AwarenessAbility"},
                    {"v": 19},
                    {"v": 14},
                    {"v": 3}
                ]},
                {"c": [
                    {"v": "Breaks"},
                    {"v": 25},
                    {"v": 12},
                    {"v": 5}
                ]},
                {"c": [
                    {"v": "LeisureActivity"},
                    {"v": 19},
                    {"v": 10},
                    {"v": 4}

                ]},
                {"c": [
                    {"v": "Nutrition"},
                    {"v": 18},
                    {"v": 14},
                    {"v": 1}

                ]},
                {"c": [
                    {"v": "PhysicalActivity"},
                    {"v": 12},
                    {"v": 6},
                    {"v": 2}

                ]},
                {"c": [
                    {"v": "Relaxation"},
                    {"v": 22},
                    {"v": 6},
                    {"v": 2}

                ]},
                {"c": [
                    {"v": "SocialInteraction"},
                    {"v": 8},
                    {"v": 6},
                    {"v": 2}

                ]},
                {"c": [
                    {"v": "TimeManagement"},
                    {"v": 12},
                    {"v": 6},
                    {"v": 2}

                ]},
                {"c": [
                    {"v": "WorkStructuring"},
                    {"v": 20},
                    {"v": 16},
                    {"v": 2}

                ]}
            ]});
        } else if (req.params.range && (req.params.range === "thisWeek")) {
            res.send({"cols": [
                {"id": "actionCluster", "label": "Aktivitätsbereich", "type": "string"},
                {"id": "open-id", "label": "offen", "type": "number"},
                {"id": "done-id", "label": "durchgeführt", "type": "number"},
                {"id": "missed-id", "label": "verpasst", "type": "number"}
            ], "rows": [
                {"c": [
                    {"v": "AwarenessAbility"},
                    {"v": 38},
                    {"v": 29},
                    {"v": 4}
                ]},
                {"c": [
                    {"v": "Breaks"},
                    {"v": 50},
                    {"v": 25},
                    {"v": 7}
                ]},
                {"c": [
                    {"v": "LeisureActivity"},
                    {"v": 68},
                    {"v": 22},
                    {"v": 8}

                ]},
                {"c": [
                    {"v": "Nutrition"},
                    {"v": 40},
                    {"v": 58},
                    {"v": 4}

                ]},
                {"c": [
                    {"v": "PhysicalActivity"},
                    {"v": 25},
                    {"v": 12},
                    {"v": 4}

                ]},
                {"c": [
                    {"v": "Relaxation"},
                    {"v": 42},
                    {"v": 9},
                    {"v": 4}

                ]},
                {"c": [
                    {"v": "SocialInteraction"},
                    {"v": 16},
                    {"v": 6},
                    {"v": 2}

                ]},
                {"c": [
                    {"v": "TimeManagement"},
                    {"v": 27},
                    {"v": 6},
                    {"v": 2}

                ]},
                {"c": [
                    {"v": "WorkStructuring"},
                    {"v": 40},
                    {"v": 6},
                    {"v": 2}

                ]}
            ]});
        } else if (req.params.range && (req.params.range === "campaign")) {
            res.send({"cols": [
                {"id": "actionCluster", "label": "Aktivitätsbereich", "type": "string"},
                {"id": "open-id", "label": "offen", "type": "number"},
                {"id": "done-id", "label": "durchgeführt", "type": "number"},
                {"id": "missed-id", "label": "verpasst", "type": "number"}
            ], "rows": [
                {"c": [
                    {"v": "AwarenessAbility"},
                    {"v": 182},
                    {"v": 91},
                    {"v": 22}
                ]},
                {"c": [
                    {"v": "Breaks"},
                    {"v": 205},
                    {"v": 102},
                    {"v": 51}
                ]},
                {"c": [
                    {"v": "LeisureActivity"},
                    {"v": 210},
                    {"v": 96},
                    {"v": 22}

                ]},
                {"c": [
                    {"v": "Nutrition"},
                    {"v": 190},
                    {"v": 77},
                    {"v": 8}

                ]},
                {"c": [
                    {"v": "PhysicalActivity"},
                    {"v": 88},
                    {"v": 25},
                    {"v": 6}

                ]},
                {"c": [
                    {"v": "Relaxation"},
                    {"v": 128},
                    {"v": 12},
                    {"v": 8}

                ]},
                {"c": [
                    {"v": "SocialInteraction"},
                    {"v": 64},
                    {"v": 12},
                    {"v": 8}

                ]},
                {"c": [
                    {"v": "TimeManagement"},
                    {"v": 97},
                    {"v": 16},
                    {"v": 12}

                ]},
                {"c": [
                    {"v": "WorkStructuring"},
                    {"v": 130},
                    {"v": 12},
                    {"v": 6}

                ]}
            ]});
        }
        return next();

    });

};