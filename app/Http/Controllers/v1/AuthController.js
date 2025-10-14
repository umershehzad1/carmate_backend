'user strict'

let jwt = require('jsonwebtoken');

let config = {}
config.app = require('../../../../config/app');

let json = require('../../../Traits/ApiResponser');

	/*
    |--------------------------------------------------------------------------
    | Authentication Controller
    |--------------------------------------------------------------------------
    |
    | This controller handles authenticating users for the application
    | get x-access-token from header to authenticates. The controller uses 
    | a trait to conveniently provide its functionality to your applications.
    |
    */

let  o = {}

    o.authenticate = (req, res, next) => {

        let token = req.headers['x-access-token'];

        if(!token){
            
            return json.errorResponse(res, 'Token Not Found', 404)
        }

        jwt.verify(token, config.app.key, function(err, decoded){

            if(err){
                
                //console.log(err);
                return json.errorResponse(res, 'Connection Unautherized!', 401)
            }

            req.decoded = decoded;
            next();
        })
    }

    // Admin authorization middleware
o.isAdmin = (req, res, next) => {
    // Ensure user is authenticated first
    if (!req.decoded) {
        return json.errorResponse(res, 'Unauthorized access!', 401);
    }

    // Check if the user role is admin
    if (req.decoded.role && req.decoded.role === 'admin') {
        next(); // User is admin, proceed
    } else {
        return json.errorResponse(res, 'Admin access required!', 403);
    }
};

module.exports = o;