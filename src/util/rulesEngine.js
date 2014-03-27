/* jshint evil: true */

var _ = require('lodash');

function rulesEngine() {

    var self = this;

    this.ruleset = {
        name: 'default',
        rules: []
    };

    this.setRuleset = function(aRuleset) {
        this.ruleset = aRuleset;
    };

    this.evaluate = function(facts) {
        var rules = (this.ruleset.rules);
        return this.doRules(rules, facts);
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
        var returnType = (this.ruleset.returnType);
        if(returnType === 'text'){
            return r.join();
        } else if(returnType.indexOf('expr') !== -1){
            return eval(returnType);
        } else if (_.isFunction(returnType)) {
            return ( (returnType)(r));
        } else if (returnType === boolean) {
            return this.returnBoolean(r);
        } else if(returnType === "ResponseData"){
            return r;
        }
        return null;
    };
}

module.exports = rulesEngine;