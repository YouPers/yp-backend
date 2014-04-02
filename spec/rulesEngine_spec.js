var RulesEngine = require('../src/util/rulesEngine');


var ruleSet = {
    returnType: "ResponseData",
    rules: [
        {id: 'id1', rule: "facts.user.username==='reto'"},
        {id: 'id2', rule: "facts.user.username==='stefan'"}
    ]};




describe('RulesEngine', function () {
    it('should correctly evaluate expression rules, ReturnType Data', function () {
        var re = new RulesEngine();
        re.setRuleset(ruleSet);
        var response = re.evaluate({user: {username: 'reto'}});
        expect(response.length).toEqual(2);
        expect(response[0]).toEqual(true);
        expect(response[1]).toEqual(false);
    });

    it('should correctly evaluate expression rules, returnType MatchingRuleId', function () {
        var re = new RulesEngine();
        ruleSet.returnType = "MatchingRuleId";
        re.setRuleset(ruleSet);
        var response = re.evaluate({user: {username: 'reto'}});
        expect(response.length).toEqual(1);
        expect(response[0]).toEqual('id1');
    });

});



