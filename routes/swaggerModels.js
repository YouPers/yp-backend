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
    }
};