'use strict'

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider within a group which
| is assigned the "api" middleware group. Enjoy building your API!
|
*/

const express = require('express');
require('express-group-routes');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage({}), limits: { fileSize: 500000000 } });

/** Controllers **/
const userCtrl = require('../app/Http/Controllers/v1/UserController');
const authCtrl = require('../app/Http/Controllers/v1/AuthController');
const uploadCtrl = require('../app/Http/Controllers/v1/UploadController');

/** Validation **/
const userReq = require('../app/Http/Requests/UserValidator');


const app = express.Router();

app.group("/user", (Route) => {

    Route.get("/", authCtrl.authenticate, userCtrl.me);
    Route.post("/signup", userReq.signup, userReq.validate, userCtrl.signup);
    Route.post("/login", userReq.signin, userReq.validate, userCtrl.login);
     Route.put(
        "/",
        authCtrl.authenticate,
        upload.single('image'),  // <-- handle file upload
        userReq.edit,
        userReq.validate,
        userCtrl.edit
    );
    Route.post("/forget-password", userReq.forgetPassword, userReq.validate, userCtrl.forgetPassword);
    Route.post("/reset-password", userReq.resetPassword, userReq.validate, userCtrl.resetPassword);
});

app.group("/upload", (Route) => {

    Route.post("/", authCtrl.authenticate, upload.single('attachment'), uploadCtrl.upload);
});


module.exports = app;