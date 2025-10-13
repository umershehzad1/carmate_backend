# carmate  Backend Api's

[![Build Status](https://travis-ci.org/joemccann/dillinger.svg?branch=master)](https://travis-ci.org/joemccann/dillinger).

## Technologies

carmate uses a number of open source projects to work properly:

* [node.js] - evented I/O for the backend
* [Express] - fast node.js network app framework [@tjholowaychuk]
* [Gulp] - the streaming build system
* [Mongoose](https://mongoosejs.com/) - Mongodb ORM

## Installation

carmate requires [Node.js](https://nodejs.org/) v12+ and [MongoDB](https://www.mongodb.com/) v4+ to run.

#### Mongodb Setup
Install [MongoDB](https://www.mongodb.com/download-center?jmp=nav) into your system...

Open Terminal (terminal 1)
Run Mongodb

```sh
$ mongod
```
Open Another Terminal (terminal 2)
Create new User in Mongodb

```sh
$ mongo
> use carmate
> db.createUser( 
    { 
        user: "root",
        pwd: "root",
        roles:
        [ 
            { role: "readWrite", db: "carmate" }
        ] 
    }
)
```

Close this terminal (terminal 2)

Now Go back to the "mongod" Terminal and press Ctrl + C to stop. It should show the output looks like this. (terminal 1) 

```sh
$ mongod // press Ctrl + C to stop process
2018-10-24T15:54:16.868+0500 I CONTROL  [initandlisten] MongoDB starting : pid=11376 port=27017 dbpath=C:\data\db\ 64-bit host=DESKTOP-PH3E1MA
.....................................................................

.....................................................................
2018-10-24T15:54:19.107+0500 I NETWORK  [HostnameCanonicalizationWorker] Starting hostname canonicalization worker
2018-10-24T15:54:19.107+0500 I FTDC     [initandlisten] Initializing full-time diagnostic data capture with directory 'C:/data/db/diagnostic.data'
2018-10-24T15:54:19.134+0500 I NETWORK  [initandlisten] waiting for connections on port 27017
^C
```
And Now Run mongodb with authentication (terminal 1)
```sh
$ mongod --auth
................................................................................
torage engine, so setting the active storage engine to 'wiredTiger'.
2018-10-24T15:56:03.352+0500 I STORAGE  [initandlisten] wiredtiger_open config: create,cache_size=4G,session_max=20000,eviction=(threads_max=4),config_base=false,statistics=(fast),log=(enabled=true,archive=true,path=journal,compressor=snappy),file_manager=(close_idle_time=100000),checkpoint=(wait=60,log_size=2GB),statistics_log=(wait=0),
2018-10-24T15:56:06.092+0500 I FTDC     [initandlisten] Initializing full-time diagnostic data capture with directory 'C:/data/db/diagnostic.data'
2018-10-24T15:56:06.092+0500 I NETWORK  [HostnameCanonicalizationWorker] Starting hostname canonicalization worker
2018-10-24T15:56:06.096+0500 I NETWORK  [initandlisten] waiting for connections on port 27017
```

If mongodb runs successfully then go the next step 

#### Clone Repository   

``` sh
$ git clone https://github.com/360Fabriek/carmate
```

Install the dependencies and devDependencies and start the server.

```sh
$ cd carmate
$ npm install -d
$ npm run
```

output:
```sh
$ node server
> Connecting to database...
Connected to database...
Server Running on port 3000
```

## .ENV Config file
Simply rename the .env-example file to .env in the project folder
```sh
$ mv .env-example .env
```
You can customize your changes as you want by changing .env file in the project folder

## Swagger Api's Documentation 
#
| Name | EndPoint |
| ------ | ------ |
| Docs | [http://localhost:3000/docs](http://localhost:3000/docs) |

#
#### Docs Endpoint:
##### METHOD: GET 
##### Path: [http://localhost:3000/docs](http://localhost:3000/docs)
####
##### Return:
return api's documentation page
#

## Sockets Emit/listener Documentation 
#
| Name | EndPoint |
| ------ | ------ |
| Docs | [https://docs.google.com/document/d/1zLmRIfX8Yzn_z5EM2bdkJlbnxc7ZWSzGUVWq4GIH2vA/edit?usp=sharing](https://docs.google.com/document/d/1zLmRIfX8Yzn_z5EM2bdkJlbnxc7ZWSzGUVWq4GIH2vA/edit?usp=sharing) |


## Test Game (Sockets) 
#
| Name | EndPoint |
| ------ | ------ |
| game | [http://localhost:3000/web/game](http://localhost:3000/web/game) |

#
#### Test Game Endpoint:
##### METHOD: GET 
##### Path: [http://localhost:3000/web/game](http://localhost:3000/web/game)
####
##### Return:
return Test game web page
#

## Development

carmate uses Gulp for fast development.
Make a change in your file and instantanously see your updates!

Open your favorite Terminal and run these commands.

Install Gulp globally
```sh
$ npm install --global gulp
```

Run Gulp in the carmate project carmate:
```sh
$ gulp
```

### Test Unit

```sh
$ npm test
```
#
##### Verify the deployment by navigating to your server address in your preferred browser.
#
```sh
127.0.0.1:3000
```
i.e
```sh
127.0.0.1:3000/api/v1/Users
```


### Todos


License
----

MIT


**Developed by carmate Dev team**

[//]: # (These are reference links used in the body of this note and get stripped out when the markdown processor does its job. There is no need to format nicely because it shouldn't be seen. Thanks SO - http://stackoverflow.com/questions/4823468/store-comments-in-markdown-syntax)


   [dill]: <https://github.com/joemccann/dillinger>
   [git-repo-url]: <https://github.com/joemccann/dillinger.git>
   [john gruber]: <http://daringfireball.net>
   [df1]: <http://daringfireball.net/projects/markdown/>
   [markdown-it]: <https://github.com/markdown-it/markdown-it>
   [Ace Editor]: <http://ace.ajax.org>
   [node.js]: <http://nodejs.org>
   [Twitter Bootstrap]: <http://twitter.github.com/bootstrap/>
   [jQuery]: <http://jquery.com>
   [@tjholowaychuk]: <http://twitter.com/tjholowaychuk>
   [express]: <http://expressjs.com>
   [AngularJS]: <http://angularjs.org>
   [Gulp]: <http://gulpjs.com>

   [PlDb]: <https://github.com/joemccann/dillinger/tree/master/plugins/dropbox/README.md>
   [PlGh]: <https://github.com/joemccann/dillinger/tree/master/plugins/github/README.md>
   [PlGd]: <https://github.com/joemccann/dillinger/tree/master/plugins/googledrive/README.md>
   [PlOd]: <https://github.com/joemccann/dillinger/tree/master/plugins/onedrive/README.md>
   [PlMe]: <https://github.com/joemccann/dillinger/tree/master/plugins/medium/README.md>
   [PlGa]: <https://github.com/RahulHP/dillinger/blob/master/plugins/googleanalytics/README.md>
