module.exports = {
    "User": {
        "id": "User",
        "required": ["id", "firstname", "lastname", "fullname", "username", "role"],
        "properties": {
            "id": {"type": "string"},
            "firstname": { "type": "string"},
            "lastname": { "type": "string" },
            "fullname": { "type": "string"},
            "email": { "type": "string"},
            "avatar": {"type": "string"},
            "username": { "type": "string"},
            "role": { "type": "string", enum: ['individual', 'healthpromoter', 'admin']},
            "preferences": { type: "string", description: "users preferences, strucutre not documented yet"}
        }
    },
    "Question": {
        "id": "Question",
        required: ["id", "category", "title"],
        properties: {
            "id": {type: "string"},
            "category": {type: "string"},
            "title": {type: "string"},
            "type": {type: "string"},
            "mintext": {type: "string"},
            "mintextexample": {type: "string"},
            "mintextresult": {type: "string"},
            "midtext": {type: "string"},
            "midtextexample": {type: "string"},
            "maxtext": {type: "string"},
            "maxtextexample": {type: "string"},
            "maxtextresult": {type: "string"},
            "exptext": {type: "string"}
        }
    },
    "QuestionCat": {
        "id": "QuestionCat",
        required: ["id", "category", "questions"],
        properties: {
            "id": {type: "string"},
            "category": {type: "string"},
            "questions": {
                type: "array",
                "items": {
                    "$ref": "Question"
                }
            }

        }
    },
    "Assessment": {
        "id": "Assessment",
        "required": ["id", "name", "questionCats"],
        "properties": {
            "id": {type: "string"},
            "name": {type: "string"},
            questionCats: {
                type: "array",
                items: {
                    "$ref": "QuestionCat"
                }
            }
        }
    },
    "AssessmentAnswer": {
        "id": "AssessmentAnswer",
        "required": ["question", "answer", "assessment"],
        properties: {
            assessment: {type: "string", description: "reference to the assessment this answer belongs to"},
            question:{type: "string", description: "reference to the question this answer belongs to"},
            answer: {type: "integer", description: "the actual answer to this question", minumum: "-100", maximum: "100"},
            answered: {type: "boolean"}
        }
    },
    "AssessmentResult": {
        "id": "AssessmentResult",
        "required": ["owner", "assessment", "answers"],
        properties: {
            owner: {type: "string", description: "reference to the user owning this Result"},
            campaign: {type: "string", description: "reference to the campaign this result was entered in, used for statistics"},
            assessment: {type: "string", description: "reference to the assessment this result belongs to"},
            timestamp: {type: "date", description: "optional on POST, is filled by server when not submitted"},
            answers: {
                type: "array",
                items: {
                    "$ref": "AssessmentAnswer"
                }
            }
        }
    }


};