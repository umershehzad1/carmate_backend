'use strict'

const { check, validationResult } = require('express-validator');

let o = {}

o.signup = [
	    	check('email')
			.trim()
	    	.isEmail().withMessage('Must Be Email'),
	    	check('password')
	    	.isLength({min: 8, max: 20}).withMessage('Password must be minimum 8 characters & maximum 20 characters ')
    	]


o.signin = [
			check('emailOrUsername')
			.trim()
			.exists()
	    	.withMessage('emailOrUsername field Required!'),
	    	check('password')
	    	.isLength({min: 8, max: 20}).withMessage('Password must be minimum 8 characters & maximum 20 characters ')
		   ]
		   
o.edit 	 = [
			check('username')
			.custom((username, {req}) => {
				if(req.body.username){
					let pattern = new RegExp(/^[a-zA-Z0-9_]{3,20}$/);
					if(!pattern.test(req.body.username)){
						throw new Error(`Enter Valid username`)
					}
				}
				return true
			}),

			check('address')
			.custom((address, {req}) => {
				if(req.body.address){
					let pattern = new RegExp(/^[\S\s]{1,100}$/);
					if(!pattern.test(req.body.address)){
						throw new Error(`Address should not be greater then 100 characters`)
					}
				}
				return true
			}),

			check('phone')
			.custom((phone, {req}) => {
				if(req.body.phone){
					let pattern = new RegExp(/^(?:(?:\(?(?:00|\+)([1-4]\d\d|[1-9]\d?)\)?)?[\-\.\ \\\/]?)?((?:\(?\d{1,}\)?[\-\.\ \\\/]?){0,})(?:[\-\.\ \\\/]?(?:#|ext\.?|extension|x)[\-\.\ \\\/]?(\d+))?$/);
					if(!pattern.test(req.body.phone)){
						throw new Error(`Enter Valid phone`)
					}
				}
				return true
			}),

			check('image')
			.custom((image, {req}) => {
				if(req.body.image){
					console.log(req.body.image);
					let pattern = new RegExp(/([a-z\-_0-9\/\:\.]*\.(jpg|jpeg|png|gif))/i);
					if(!pattern.test(req.body.image)){
						throw new Error(`Enter Valid image url`)
					}
				}
				return true
			})
		]
		
o.forgetPassword = [
			check('email')
			.trim()
	    	.isEmail().withMessage('Must Be Email'),
		]

o.resetPassword = [
			check('email')
			.trim()
	    	.isEmail().withMessage('Must Be Email'),
			check('code')
			.exists(),
	    	check('password')
	    	.isLength({min: 8, max: 20}).withMessage('Password must be minimum 8 characters & maximum 20 characters ')
		]

o.validate = function(req, res, next){

	let errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation Error', errors: errors.array(), code: 400 });
    }

  	next();
}

module.exports = o;