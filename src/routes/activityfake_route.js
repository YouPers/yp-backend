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
                    {"v": "awarenessAbility"},
                    {"v": 19},
                    {"v": 14},
                    {"v": 3}
                ]},
                {"c": [
                    {"v": "breaks"},
                    {"v": 25},
                    {"v": 12},
                    {"v": 5}
                ]},
                {"c": [
                    {"v": "leisureActivity"},
                    {"v": 19},
                    {"v": 10},
                    {"v": 4}

                ]},
                {"c": [
                    {"v": "nutrition"},
                    {"v": 18},
                    {"v": 14},
                    {"v": 1}

                ]},
                {"c": [
                    {"v": "physicalActivity"},
                    {"v": 12},
                    {"v": 6},
                    {"v": 2}

                ]},
                {"c": [
                    {"v": "relaxation"},
                    {"v": 22},
                    {"v": 6},
                    {"v": 2}

                ]},
                {"c": [
                    {"v": "socialInteraction"},
                    {"v": 8},
                    {"v": 6},
                    {"v": 2}

                ]},
                {"c": [
                    {"v": "timeManagement"},
                    {"v": 12},
                    {"v": 6},
                    {"v": 2}

                ]},
                {"c": [
                    {"v": "workStructuring"},
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
                    {"v": "awarenessAbility"},
                    {"v": 38},
                    {"v": 29},
                    {"v": 4}
                ]},
                {"c": [
                    {"v": "breaks"},
                    {"v": 50},
                    {"v": 25},
                    {"v": 7}
                ]},
                {"c": [
                    {"v": "leisureActivity"},
                    {"v": 68},
                    {"v": 22},
                    {"v": 8}

                ]},
                {"c": [
                    {"v": "nutrition"},
                    {"v": 40},
                    {"v": 58},
                    {"v": 4}

                ]},
                {"c": [
                    {"v": "physicalActivity"},
                    {"v": 25},
                    {"v": 12},
                    {"v": 4}

                ]},
                {"c": [
                    {"v": "relaxation"},
                    {"v": 42},
                    {"v": 9},
                    {"v": 4}

                ]},
                {"c": [
                    {"v": "socialInteraction"},
                    {"v": 16},
                    {"v": 6},
                    {"v": 2}

                ]},
                {"c": [
                    {"v": "timeManagement"},
                    {"v": 27},
                    {"v": 6},
                    {"v": 2}

                ]},
                {"c": [
                    {"v": "workStructuring"},
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
                    {"v": "awarenessAbility"},
                    {"v": 182},
                    {"v": 91},
                    {"v": 22}
                ]},
                {"c": [
                    {"v": "breaks"},
                    {"v": 205},
                    {"v": 102},
                    {"v": 51}
                ]},
                {"c": [
                    {"v": "leisureActivity"},
                    {"v": 210},
                    {"v": 96},
                    {"v": 22}

                ]},
                {"c": [
                    {"v": "nutrition"},
                    {"v": 190},
                    {"v": 77},
                    {"v": 8}

                ]},
                {"c": [
                    {"v": "physicalActivity"},
                    {"v": 88},
                    {"v": 25},
                    {"v": 6}

                ]},
                {"c": [
                    {"v": "relaxation"},
                    {"v": 128},
                    {"v": 12},
                    {"v": 8}

                ]},
                {"c": [
                    {"v": "socialInteraction"},
                    {"v": 64},
                    {"v": 12},
                    {"v": 8}

                ]},
                {"c": [
                    {"v": "timeManagement"},
                    {"v": 97},
                    {"v": 16},
                    {"v": 12}

                ]},
                {"c": [
                    {"v": "workStructuring"},
                    {"v": 130},
                    {"v": 12},
                    {"v": 6}

                ]}
            ]});
        }
        return next();

    });

};