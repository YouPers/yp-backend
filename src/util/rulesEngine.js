/* jshint evil: true */

var _ = require('lodash');

function RulesEngine(aRuleSet) {

    var self = this;

    if (aRuleSet) {
        self.ruleset = aRuleSet;
    } else {
        self.ruleset = {
            name: 'default',
            rules: []
        };
    }

    this.setRuleset = function(aRuleset) {
        self.ruleset = aRuleset;
    };

    this.evaluate = function(facts) {
        var rules = self.ruleset.rules;
        return this.respond(this.doRules(rules, facts));
    };

    this.doRules= function(rules, facts) {
        var results = [];
        _.forEach(rules, function(rule) {
            if (_.isArray(rule.rule)) {
                results.push(self.doRules(rule.rule, facts));
            } else if (_.isFunction(rule.rule)) {
                results.push(rule.rule(facts));
            }  else {
                results.push(eval(rule.rule));
            }
        });
        return results;
    };

    this.respond = function(r) {
        var returnType = self.ruleset.returnType;


        if(returnType === 'text'){
            return r.join();
        } else if(returnType.indexOf('expr') !== -1){
            return eval(returnType);
        } else if (_.isFunction(returnType)) {
            return ( (returnType)(r));
        } else if(returnType === "ResponseData"){
            return r;
        } else if (returnType === "MatchingRuleId") {
            var response = [];
            for (var i = 0; i<r.length; i++) {
                if (r[i]) {
                    response.push(self.ruleset.rules[i].id);
                }
            }
            return response;
        } else {
            throw new Error('Unknown Returntype');
        }
    };
}

module.exports = RulesEngine;