var auth = require('../src/util/auth');


describe('Authentication Module', function () {
    it('should correctly check whether a role is an admin role', function () {
        expect(auth.isAdminForModel('individual', ['systemadmin'])).toBe(false);
        expect(auth.isAdminForModel('orgadmin',['systemadmin'])).toBe(false);
        expect(auth.isAdminForModel('productadmin',['systemadmin', 'productadmin'])).toBe(true);
        expect(auth.isAdminForModel('systemadmin',['systemadmin', 'productadmin'])).toBe(true);
        expect(auth.isAdminForModel(['systemadmin'],['systemadmin', 'productadmin'])).toBe(true);
        expect(auth.isAdminForModel(['systemadmin', 'individual'],['systemadmin', 'productadmin'])).toBe(true);
        expect(auth.isAdminForModel(['anonymous', 'individual'],['systemadmin', 'productadmin'])).toBe(false);
        expect(auth.isAdminForModel([],['systemadmin', 'productadmin'])).toBe(false);
        expect(auth.isAdminForModel(null,['systemadmin', 'productadmin'])).toBe(false);

    });

    it('should correctly determine whether a user can assign a new role', function() {
        expect(auth.canAssign('individual', 'productadmin')).toBe(false);
        expect(auth.canAssign('systemadmin', 'productadmin')).toBe(true);
        expect(auth.canAssign('anonymous', 'individual')).toBe(true);
        expect(auth.canAssign('anonymous', 'systemadmin')).toBe(false);
        expect(auth.canAssign('productadmin', 'systemadmin')).toBe(false);
        expect(auth.canAssign('healthpromoter', 'systemadmin')).toBe(false);
    });

    it('should perform role based authorization by allowing / disallowing access', function() {
        auth.checkAccess('anonymous', auth.accessLevels.al_all, function(err) {
            expect(err).toBeUndefined();
        });
        auth.checkAccess('individual', auth.accessLevels.al_all, function(err) {
           expect(err).toBeUndefined();
       });
        auth.checkAccess('individual', auth.accessLevels.al_systemadmin, function(err) {
            expect(err).toBeDefined();
        });
        auth.checkAccess('systemadmin', auth.accessLevels.al_systemadmin, function(err) {
            expect(err).toBeUndefined();
        });
        auth.checkAccess('individual', auth.accessLevels.al_anonymousonly, function(err) {
            expect(err).toBeDefined();
        });
        auth.checkAccess(undefined, auth.accessLevels.al_admin, function(err) {
            expect(err).toBeDefined();
        });
        auth.checkAccess(undefined, auth.accessLevels.al_all, function(err) {
            expect(err).toBeUndefined();
        });
        auth.checkAccess(undefined, auth.accessLevels.al_anonymousonly, function(err) {
            expect(err).toBeUndefined();
        });

    });
});