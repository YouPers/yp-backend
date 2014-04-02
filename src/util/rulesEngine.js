/* jshint evil: true */

var _ = require('lodash');


/**
 * simple RulesEngine that evaluates rules against a Facts object.
 *
 * Rules can be written as:
 * - javascript function(facts) {}
 * - eval expression using facts.property
 * rules may be used recursively (experimental feature, fasten seatbelt before using)
 *
 * a ruleset may specify what result it expects from the evaluated rules in the property: returnType
 * supported values are:
 * - 'ResponseData': get the raw array of responseData. Each rule's result is pushed into this resultarray.
 * - 'MatchingRuleId': get an array of the id of all rules that evaluated to a truthy result.
 * - function(r): a javascript function that does something with the raw result array.
 * - 'text': .join() of the raw result array.
 *
 * Usage:
 * var yourRuleSet = {
 *  returnType: 'ResponseData',
 *  rules: [
 *  {id: 'ruleId1', rule: 'facts.name=="blalba"'},
 *  {id: 'ruleId1', rule: 'facts.count>= 7'},
 *  ]}
 *
 * var facts = calculateYourFacts();
 *
 * var re = new RulesEngine(yourRulesSet).
 * var result = re.evaluate(facts);
 *
 * @param aRuleSet
 * @constructor
 */
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