module.exports =
/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};

/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {

/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;

/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			exports: {},
/******/ 			id: moduleId,
/******/ 			loaded: false
/******/ 		};

/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);

/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;

/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}


/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;

/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;

/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "/build/";

/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	var Webtask = __webpack_require__(1);

	// This is the entry-point for the Webpack build. We need to convert our module
	// (which is a simple Express server) into a Webtask-compatible function.
	module.exports = Webtask.fromExpress(__webpack_require__(2));

/***/ },
/* 1 */
/***/ function(module, exports) {

	module.exports = require("webtask-tools");

/***/ },
/* 2 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	var _keys = __webpack_require__(3);

	var _keys2 = _interopRequireDefault(_keys);

	var _parseInt = __webpack_require__(38);

	var _parseInt2 = _interopRequireDefault(_parseInt);

	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

	var auth0 = __webpack_require__(44);
	var Webtask = __webpack_require__(1);
	var metadata = __webpack_require__(45);
	var request = __webpack_require__(46);
	var async = __webpack_require__(47);
	var express = __webpack_require__(48);
	var Request = __webpack_require__(46);
	var memoizer = __webpack_require__(49);
	var jwt = __webpack_require__(52);
	var app = express();

	function lastLogCheckpoint(req, res) {
	    var ctx = req.webtaskContext;
	    var required_settings = ['AUTH0_DOMAIN', 'AUTH0_APP_CLIENT_SECRET', 'AUTH0_APP_CLIENT_ID', 'AUTH0_TOKEN'];
	    var missing_settings = required_settings.filter(function (setting) {
	        return !ctx.data[setting];
	    });

	    if (missing_settings.length) {
	        console.log(missing_settings.join(', '));
	        return res.status(400).send({
	            message: 'Missing settings: ' + missing_settings.join(', ')
	        });
	    }

	    // If this is a scheduled task, we'll get the last log checkpoint from the
	    // previous run and continue from there.
	    req.webtaskContext.storage.get(function (err, data) {
	        if (err && err.output.statusCode !== 404) return res.status(err.code).send(err);

	        var startCheckpointId = typeof data === 'undefined' ? null : data.checkpointId;

	        console.log("Data checkpointId", startCheckpointId);

	        // Start the process.
	        async.waterfall([function (callback) {
	            var getLogs = function getLogs(context) {
	                console.log('Logs from: ' + (context.checkpointId || 'Start') + '.');

	                var take = (0, _parseInt2.default)(ctx.data.BATCH_SIZE);

	                take = take > 100 ? 100 : take;

	                context.logs = context.logs || [];

	                getLogsFromAuth0(req.webtaskContext.data.AUTH0_DOMAIN, req.webtaskContext.data.AUTH0_APP_CLIENT_ID, req.webtaskContext.data.AUTH0_TOKEN, take, context.checkpointId, function (logs, err) {
	                    if (err) {
	                        console.log('Error getting logs from Auth0', err);
	                        return callback(err);
	                    }

	                    if (logs && logs.length) {
	                        logs.forEach(function (l) {
	                            return context.logs.push(l);
	                        });
	                        context.checkpointId = context.logs[context.logs.length - 1]._id;
	                    }

	                    console.log('Total logs: ' + context.logs.length + '.');
	                    return callback(null, context);
	                });
	            };

	            getLogs({
	                checkpointId: startCheckpointId
	            });
	        }, function (context, callback) {

	            var endpoints_filter = ctx.data.AUTH0_API_ENDPOINTS ? ctx.data.AUTH0_API_ENDPOINTS.split(',') : "users";

	            var request_matches_filter = function request_matches_filter(log) {

	                if (!endpoints_filter || !endpoints_filter.length) return true;

	                return log.details.request && log.details.request.path && endpoints_filter.some(function (f) {
	                    return log.details.request.path === '/api/v2/' + f || log.details.request.path.indexOf('/api/v2/' + f + '/') >= 0;
	                });
	            };

	            var USER_API_URL = "/api/v2/users/";

	            /** *************************** */
	            var user_update_log = function only_user_update_filter(l) {

	                var request = l.details.request;

	                if (!request || request.method != "patch" || !request.path || request.path.indexOf(USER_API_URL) == -1 || !ctx.data.UPDATE_USER_WEBHOOK_URL) {
	                    return false;
	                }

	                if (!ctx.data.UPDATE_USER_WEBHOOK_URL) {
	                    return;
	                }

	                var userUrl = request.path;
	                return decodeURI(userUrl.replace(USER_API_URL, ""));
	            };

	            var user_delete_log = function only_user_update_filter(l) {

	                var request = l.details.request;

	                if (!request || request.method != "delete" || !request.path || request.path.indexOf(USER_API_URL) == -1) {
	                    return false;
	                }

	                if (!ctx.data.DELETE_USER_WEBHOOK_URL) {
	                    return;
	                }

	                var userUrl = request.path;
	                return decodeURI(userUrl.replace(USER_API_URL, ""));
	            };

	            var user_email = function only_user_update_filter(l) {

	                var request = l.details.request;

	                if (!request || request.method != "delete" || !request.path || request.path.indexOf(USER_API_URL) == -1) {
	                    return "";
	                }

	                if (request.auth.user.email) {
	                    return request.auth.user.email;
	                }

	                return request.body.email;
	            };

	            var user_success_signup_log = function only_user_update_filter(l) {

	                if (l.details.request.type != "ss") {
	                    return;
	                }

	                if (!ctx.data.SIGN_UP_USER_WEBHOOK_URL) {
	                    return;
	                }

	                return l.details.request.user_id;
	            };

	            /** *************************** */

	            context.logs = context.logs.filter(function (l) {
	                return l.type === 'sapi' || l.type === 'fapi';
	            }).filter(function (l) {
	                return user_update_log(l) || user_success_signup_log(l) || user_delete_log(l);
	            }).map(function (l) {
	                var userUpdateId = user_update_log(l) || user_success_signup_log(l);
	                var userDeleteId = user_delete_log(l);
	                var userEmail = user_email(l);

	                return {
	                    date: l.date,
	                    type: userDeleteId ? "delete" : "update",
	                    userId: userDeleteId || userUpdateId,
	                    email: userEmail
	                };
	            });

	            callback(null, context);
	        },
	        // // STEP 4: Sending information
	        function (context, callback) {

	            if (!context.logs.length) {
	                /** *************************** */
	                console.log("Logs are empty");
	                /** *************************** */
	                return callback(null, context);
	            }

	            // Grouped by userId
	            var logs = context.logs.reduce(function (acc, item) {
	                var key = item.userId;
	                acc[key] = acc[key] || [];
	                acc[key].push(item);
	                return acc;
	            }, {});

	            (0, _keys2.default)(logs).forEach(function (userId) {

	                // Grouped by action and remove duplications
	                logs[userId] = logs[userId].reduce(function (acc, item) {
	                    var key = item.type;

	                    if (!acc[key] || acc[key].date < item.date) {
	                        acc[key] = {
	                            date: item.date,
	                            email: item.email
	                        };
	                    }

	                    return acc;
	                }, {});
	            });

	            console.log("Logs:", logs);

	            var concurrent_calls = ctx.data.WEBHOOK_CONCURRENT_CALLS || 5;

	            async.eachLimit((0, _keys2.default)(logs), concurrent_calls, function (userId, cb) {

	                console.log("Log:", logs[userId]);

	                var deleteAction = logs[userId]["delete"];
	                var updateAction = logs[userId]["update"];

	                var deleteActionDate = deleteAction && deleteAction.date;
	                var updateActionDate = updateAction && updateAction.date;

	                var email = deleteAction && deleteAction.email;

	                console.log("Email:", email);
	                console.log("DeleteActionDate:", deleteActionDate);
	                console.log("UpdateActionDate:", updateActionDate);

	                if (updateActionDate && !deleteActionDate) {
	                    console.log("User(" + userId + ") profile is updated");
	                    updateOIEUserData(req, userId, ctx, function (err) {
	                        err ? cb(err) : cb();
	                    });
	                } else if (!updateActionDate && deleteActionDate) {
	                    console.log("User(" + email + ") profile is removed");
	                    deleteOIEUserData(req, email, ctx, function (err) {
	                        err ? cb(err) : cb();
	                    });
	                } else if (updateActionDate > deleteActionDate) {
	                    console.log("User(" + userId + ") profile is removed, but signed up again");
	                    updateOIEUserData(req, userId, ctx, function (err) {
	                        err ? cb(err) : cb();
	                    });
	                } else if (updateActionDate < deleteActionDate) {
	                    console.log("User(" + email + ") profile is updated, but also removed");
	                    deleteOIEUserData(req, email, ctx, function (err) {
	                        err ? cb(err) : cb();
	                    });
	                }
	            }, function (err) {
	                if (err) {
	                    return callback(err);
	                }

	                console.log('Upload complete.');
	                return callback(null, context);
	            });
	        }], function (err, context) {
	            if (err) {
	                console.log('Job failed.');

	                return req.webtaskContext.storage.set({
	                    checkpointId: startCheckpointId
	                }, {
	                    force: 1
	                }, function (error) {
	                    if (error) {
	                        console.log('Error storing startCheckpoint', error);
	                        return res.status(500).send({
	                            error: error
	                        });
	                    }

	                    res.status(500).send({
	                        error: err
	                    });
	                });
	            }

	            console.log('Job complete.');

	            return req.webtaskContext.storage.set({
	                checkpointId: context.checkpointId,
	                totalLogsProcessed: context.logs.length
	            }, {
	                force: 1
	            }, function (error) {
	                if (error) {
	                    console.log('Error storing checkpoint', error);
	                    return res.status(500).send({
	                        error: error
	                    });
	                }

	                res.sendStatus(200);
	            });
	        });
	    });
	}

	function updateOIEUserData(req, userId, ctx, cb) {

	    var url = ctx.data.UPDATE_USER_WEBHOOK_URL || ctx.data.SIGN_UP_USER_WEBHOOK_URL;

	    console.log('Sending to \'' + url + '\'');

	    var log_converter = function log_converter(userResponse) {
	        console.log("Create signed data for user(" + userResponse.user_metadata.userId + "), auth0 userId: " + userResponse.user_id);
	        var secret = new Buffer(ctx.data.AUTH0_APP_CLIENT_SECRET, 'base64').toString('binary');
	        return {
	            'token': jwt.sign(userResponse, secret)
	        };
	    };

	    getUserDataFromAuth0(req.webtaskContext.data.AUTH0_DOMAIN, req.webtaskContext.data.AUTH0_TOKEN, userId, function (userResponse, err) {

	        if (!userResponse) {
	            console.log('User data is not found by ', userId);
	            return cb();
	        }

	        request.post(url).type('form').send(log_converter(userResponse)).end(function (err, res) {
	            if (err && !res.ok && res.status != 404) {
	                console.log('Error sending request:', err, res.body);
	                return cb(err);
	            }

	            if (res.status == 404) {
	                console.log('Resource is not found');
	            }

	            return cb();
	        });
	    });
	}

	function deleteOIEUserData(req, email, ctx, cb) {

	    var url = ctx.data.DELETE_USER_WEBHOOK_URL;

	    console.log('Sending to \'' + url + '\'');

	    var log_converter = function log_converter(email) {
	        console.log("Create delete signed data for user(" + email + ")");
	        var secret = new Buffer(ctx.data.AUTH0_APP_CLIENT_SECRET, 'base64').toString('binary');

	        return {
	            'token': jwt.sign({
	                "email": email
	            }, secret)
	        };
	    };

	    request.post(url).type('form').send(log_converter(email)).end(function (err, res) {
	        if (err && !res.ok && res.status != 404 && res.status != 410) {
	            console.log('Error sending request:', err, res.body);
	            return cb(err);
	        }

	        if (res.status == 404) {
	            console.log('Resource is not found');
	        }

	        return cb();
	    });
	};

	function getLogsFromAuth0(domain, client_id, token, take, from, cb) {
	    var url = 'https://' + domain + '/api/v2/logs';

	    Request.get(url).set('Authorization', 'Bearer ' + token).set('Accept', 'application/json').query({
	        q: "client_id=" + client_id
	    }).query({
	        take: take
	    }).query({
	        from: from
	    }).query({
	        sort: 'date:1'
	    }).query({
	        per_page: take
	    }).end(function (err, res) {
	        if (err || !res.ok) {
	            console.log('Error getting logs', err);
	            cb(null, err);
	        } else {
	            console.log('x-ratelimit-limit: ', res.headers['x-ratelimit-limit'], 'x-ratelimit-remaining: ', res.headers['x-ratelimit-remaining'], 'x-ratelimit-reset: ', res.headers['x-ratelimit-reset']);
	            cb(res.body);
	        }
	    });
	}

	function getUserDataFromAuth0(domain, token, userId, cb) {

	    var startWithAuth0 = userId.indexOf("|") != -1;

	    var url = 'https://' + domain + '/api/v2/users/' + encodeURI(startWithAuth0 ? userId : "auth0|" + userId);

	    Request.get(url).set('Authorization', 'Bearer ' + token).set('Accept', 'application/json').end(function (err, res) {
	        if (err || !res.ok) {
	            console.log('Error getting logs', err);
	            cb(null, err);
	        } else {
	            cb(res.body);
	        }
	    });
	}

	app.get('/', lastLogCheckpoint);
	app.post('/', lastLogCheckpoint);

	app.get('/meta', function (req, res) {
	    res.status(200).send(metadata);
	});

	module.exports = app;

/***/ },
/* 3 */
/***/ function(module, exports, __webpack_require__) {

	module.exports = { "default": __webpack_require__(4), __esModule: true };

/***/ },
/* 4 */
/***/ function(module, exports, __webpack_require__) {

	__webpack_require__(5);
	module.exports = __webpack_require__(25).Object.keys;

/***/ },
/* 5 */
/***/ function(module, exports, __webpack_require__) {

	// 19.1.2.14 Object.keys(O)
	var toObject = __webpack_require__(6)
	  , $keys    = __webpack_require__(8);

	__webpack_require__(23)('keys', function(){
	  return function keys(it){
	    return $keys(toObject(it));
	  };
	});

/***/ },
/* 6 */
/***/ function(module, exports, __webpack_require__) {

	// 7.1.13 ToObject(argument)
	var defined = __webpack_require__(7);
	module.exports = function(it){
	  return Object(defined(it));
	};

/***/ },
/* 7 */
/***/ function(module, exports) {

	// 7.2.1 RequireObjectCoercible(argument)
	module.exports = function(it){
	  if(it == undefined)throw TypeError("Can't call method on  " + it);
	  return it;
	};

/***/ },
/* 8 */
/***/ function(module, exports, __webpack_require__) {

	// 19.1.2.14 / 15.2.3.14 Object.keys(O)
	var $keys       = __webpack_require__(9)
	  , enumBugKeys = __webpack_require__(22);

	module.exports = Object.keys || function keys(O){
	  return $keys(O, enumBugKeys);
	};

/***/ },
/* 9 */
/***/ function(module, exports, __webpack_require__) {

	var has          = __webpack_require__(10)
	  , toIObject    = __webpack_require__(11)
	  , arrayIndexOf = __webpack_require__(14)(false)
	  , IE_PROTO     = __webpack_require__(18)('IE_PROTO');

	module.exports = function(object, names){
	  var O      = toIObject(object)
	    , i      = 0
	    , result = []
	    , key;
	  for(key in O)if(key != IE_PROTO)has(O, key) && result.push(key);
	  // Don't enum bug & hidden keys
	  while(names.length > i)if(has(O, key = names[i++])){
	    ~arrayIndexOf(result, key) || result.push(key);
	  }
	  return result;
	};

/***/ },
/* 10 */
/***/ function(module, exports) {

	var hasOwnProperty = {}.hasOwnProperty;
	module.exports = function(it, key){
	  return hasOwnProperty.call(it, key);
	};

/***/ },
/* 11 */
/***/ function(module, exports, __webpack_require__) {

	// to indexed object, toObject with fallback for non-array-like ES3 strings
	var IObject = __webpack_require__(12)
	  , defined = __webpack_require__(7);
	module.exports = function(it){
	  return IObject(defined(it));
	};

/***/ },
/* 12 */
/***/ function(module, exports, __webpack_require__) {

	// fallback for non-array-like ES3 and non-enumerable old V8 strings
	var cof = __webpack_require__(13);
	module.exports = Object('z').propertyIsEnumerable(0) ? Object : function(it){
	  return cof(it) == 'String' ? it.split('') : Object(it);
	};

/***/ },
/* 13 */
/***/ function(module, exports) {

	var toString = {}.toString;

	module.exports = function(it){
	  return toString.call(it).slice(8, -1);
	};

/***/ },
/* 14 */
/***/ function(module, exports, __webpack_require__) {

	// false -> Array#indexOf
	// true  -> Array#includes
	var toIObject = __webpack_require__(11)
	  , toLength  = __webpack_require__(15)
	  , toIndex   = __webpack_require__(17);
	module.exports = function(IS_INCLUDES){
	  return function($this, el, fromIndex){
	    var O      = toIObject($this)
	      , length = toLength(O.length)
	      , index  = toIndex(fromIndex, length)
	      , value;
	    // Array#includes uses SameValueZero equality algorithm
	    if(IS_INCLUDES && el != el)while(length > index){
	      value = O[index++];
	      if(value != value)return true;
	    // Array#toIndex ignores holes, Array#includes - not
	    } else for(;length > index; index++)if(IS_INCLUDES || index in O){
	      if(O[index] === el)return IS_INCLUDES || index || 0;
	    } return !IS_INCLUDES && -1;
	  };
	};

/***/ },
/* 15 */
/***/ function(module, exports, __webpack_require__) {

	// 7.1.15 ToLength
	var toInteger = __webpack_require__(16)
	  , min       = Math.min;
	module.exports = function(it){
	  return it > 0 ? min(toInteger(it), 0x1fffffffffffff) : 0; // pow(2, 53) - 1 == 9007199254740991
	};

/***/ },
/* 16 */
/***/ function(module, exports) {

	// 7.1.4 ToInteger
	var ceil  = Math.ceil
	  , floor = Math.floor;
	module.exports = function(it){
	  return isNaN(it = +it) ? 0 : (it > 0 ? floor : ceil)(it);
	};

/***/ },
/* 17 */
/***/ function(module, exports, __webpack_require__) {

	var toInteger = __webpack_require__(16)
	  , max       = Math.max
	  , min       = Math.min;
	module.exports = function(index, length){
	  index = toInteger(index);
	  return index < 0 ? max(index + length, 0) : min(index, length);
	};

/***/ },
/* 18 */
/***/ function(module, exports, __webpack_require__) {

	var shared = __webpack_require__(19)('keys')
	  , uid    = __webpack_require__(21);
	module.exports = function(key){
	  return shared[key] || (shared[key] = uid(key));
	};

/***/ },
/* 19 */
/***/ function(module, exports, __webpack_require__) {

	var global = __webpack_require__(20)
	  , SHARED = '__core-js_shared__'
	  , store  = global[SHARED] || (global[SHARED] = {});
	module.exports = function(key){
	  return store[key] || (store[key] = {});
	};

/***/ },
/* 20 */
/***/ function(module, exports) {

	// https://github.com/zloirock/core-js/issues/86#issuecomment-115759028
	var global = module.exports = typeof window != 'undefined' && window.Math == Math
	  ? window : typeof self != 'undefined' && self.Math == Math ? self : Function('return this')();
	if(typeof __g == 'number')__g = global; // eslint-disable-line no-undef

/***/ },
/* 21 */
/***/ function(module, exports) {

	var id = 0
	  , px = Math.random();
	module.exports = function(key){
	  return 'Symbol('.concat(key === undefined ? '' : key, ')_', (++id + px).toString(36));
	};

/***/ },
/* 22 */
/***/ function(module, exports) {

	// IE 8- don't enum bug keys
	module.exports = (
	  'constructor,hasOwnProperty,isPrototypeOf,propertyIsEnumerable,toLocaleString,toString,valueOf'
	).split(',');

/***/ },
/* 23 */
/***/ function(module, exports, __webpack_require__) {

	// most Object methods by ES6 should accept primitives
	var $export = __webpack_require__(24)
	  , core    = __webpack_require__(25)
	  , fails   = __webpack_require__(34);
	module.exports = function(KEY, exec){
	  var fn  = (core.Object || {})[KEY] || Object[KEY]
	    , exp = {};
	  exp[KEY] = exec(fn);
	  $export($export.S + $export.F * fails(function(){ fn(1); }), 'Object', exp);
	};

/***/ },
/* 24 */
/***/ function(module, exports, __webpack_require__) {

	var global    = __webpack_require__(20)
	  , core      = __webpack_require__(25)
	  , ctx       = __webpack_require__(26)
	  , hide      = __webpack_require__(28)
	  , PROTOTYPE = 'prototype';

	var $export = function(type, name, source){
	  var IS_FORCED = type & $export.F
	    , IS_GLOBAL = type & $export.G
	    , IS_STATIC = type & $export.S
	    , IS_PROTO  = type & $export.P
	    , IS_BIND   = type & $export.B
	    , IS_WRAP   = type & $export.W
	    , exports   = IS_GLOBAL ? core : core[name] || (core[name] = {})
	    , expProto  = exports[PROTOTYPE]
	    , target    = IS_GLOBAL ? global : IS_STATIC ? global[name] : (global[name] || {})[PROTOTYPE]
	    , key, own, out;
	  if(IS_GLOBAL)source = name;
	  for(key in source){
	    // contains in native
	    own = !IS_FORCED && target && target[key] !== undefined;
	    if(own && key in exports)continue;
	    // export native or passed
	    out = own ? target[key] : source[key];
	    // prevent global pollution for namespaces
	    exports[key] = IS_GLOBAL && typeof target[key] != 'function' ? source[key]
	    // bind timers to global for call from export context
	    : IS_BIND && own ? ctx(out, global)
	    // wrap global constructors for prevent change them in library
	    : IS_WRAP && target[key] == out ? (function(C){
	      var F = function(a, b, c){
	        if(this instanceof C){
	          switch(arguments.length){
	            case 0: return new C;
	            case 1: return new C(a);
	            case 2: return new C(a, b);
	          } return new C(a, b, c);
	        } return C.apply(this, arguments);
	      };
	      F[PROTOTYPE] = C[PROTOTYPE];
	      return F;
	    // make static versions for prototype methods
	    })(out) : IS_PROTO && typeof out == 'function' ? ctx(Function.call, out) : out;
	    // export proto methods to core.%CONSTRUCTOR%.methods.%NAME%
	    if(IS_PROTO){
	      (exports.virtual || (exports.virtual = {}))[key] = out;
	      // export proto methods to core.%CONSTRUCTOR%.prototype.%NAME%
	      if(type & $export.R && expProto && !expProto[key])hide(expProto, key, out);
	    }
	  }
	};
	// type bitmap
	$export.F = 1;   // forced
	$export.G = 2;   // global
	$export.S = 4;   // static
	$export.P = 8;   // proto
	$export.B = 16;  // bind
	$export.W = 32;  // wrap
	$export.U = 64;  // safe
	$export.R = 128; // real proto method for `library` 
	module.exports = $export;

/***/ },
/* 25 */
/***/ function(module, exports) {

	var core = module.exports = {version: '2.4.0'};
	if(typeof __e == 'number')__e = core; // eslint-disable-line no-undef

/***/ },
/* 26 */
/***/ function(module, exports, __webpack_require__) {

	// optional / simple context binding
	var aFunction = __webpack_require__(27);
	module.exports = function(fn, that, length){
	  aFunction(fn);
	  if(that === undefined)return fn;
	  switch(length){
	    case 1: return function(a){
	      return fn.call(that, a);
	    };
	    case 2: return function(a, b){
	      return fn.call(that, a, b);
	    };
	    case 3: return function(a, b, c){
	      return fn.call(that, a, b, c);
	    };
	  }
	  return function(/* ...args */){
	    return fn.apply(that, arguments);
	  };
	};

/***/ },
/* 27 */
/***/ function(module, exports) {

	module.exports = function(it){
	  if(typeof it != 'function')throw TypeError(it + ' is not a function!');
	  return it;
	};

/***/ },
/* 28 */
/***/ function(module, exports, __webpack_require__) {

	var dP         = __webpack_require__(29)
	  , createDesc = __webpack_require__(37);
	module.exports = __webpack_require__(33) ? function(object, key, value){
	  return dP.f(object, key, createDesc(1, value));
	} : function(object, key, value){
	  object[key] = value;
	  return object;
	};

/***/ },
/* 29 */
/***/ function(module, exports, __webpack_require__) {

	var anObject       = __webpack_require__(30)
	  , IE8_DOM_DEFINE = __webpack_require__(32)
	  , toPrimitive    = __webpack_require__(36)
	  , dP             = Object.defineProperty;

	exports.f = __webpack_require__(33) ? Object.defineProperty : function defineProperty(O, P, Attributes){
	  anObject(O);
	  P = toPrimitive(P, true);
	  anObject(Attributes);
	  if(IE8_DOM_DEFINE)try {
	    return dP(O, P, Attributes);
	  } catch(e){ /* empty */ }
	  if('get' in Attributes || 'set' in Attributes)throw TypeError('Accessors not supported!');
	  if('value' in Attributes)O[P] = Attributes.value;
	  return O;
	};

/***/ },
/* 30 */
/***/ function(module, exports, __webpack_require__) {

	var isObject = __webpack_require__(31);
	module.exports = function(it){
	  if(!isObject(it))throw TypeError(it + ' is not an object!');
	  return it;
	};

/***/ },
/* 31 */
/***/ function(module, exports) {

	module.exports = function(it){
	  return typeof it === 'object' ? it !== null : typeof it === 'function';
	};

/***/ },
/* 32 */
/***/ function(module, exports, __webpack_require__) {

	module.exports = !__webpack_require__(33) && !__webpack_require__(34)(function(){
	  return Object.defineProperty(__webpack_require__(35)('div'), 'a', {get: function(){ return 7; }}).a != 7;
	});

/***/ },
/* 33 */
/***/ function(module, exports, __webpack_require__) {

	// Thank's IE8 for his funny defineProperty
	module.exports = !__webpack_require__(34)(function(){
	  return Object.defineProperty({}, 'a', {get: function(){ return 7; }}).a != 7;
	});

/***/ },
/* 34 */
/***/ function(module, exports) {

	module.exports = function(exec){
	  try {
	    return !!exec();
	  } catch(e){
	    return true;
	  }
	};

/***/ },
/* 35 */
/***/ function(module, exports, __webpack_require__) {

	var isObject = __webpack_require__(31)
	  , document = __webpack_require__(20).document
	  // in old IE typeof document.createElement is 'object'
	  , is = isObject(document) && isObject(document.createElement);
	module.exports = function(it){
	  return is ? document.createElement(it) : {};
	};

/***/ },
/* 36 */
/***/ function(module, exports, __webpack_require__) {

	// 7.1.1 ToPrimitive(input [, PreferredType])
	var isObject = __webpack_require__(31);
	// instead of the ES6 spec version, we didn't implement @@toPrimitive case
	// and the second argument - flag - preferred type is a string
	module.exports = function(it, S){
	  if(!isObject(it))return it;
	  var fn, val;
	  if(S && typeof (fn = it.toString) == 'function' && !isObject(val = fn.call(it)))return val;
	  if(typeof (fn = it.valueOf) == 'function' && !isObject(val = fn.call(it)))return val;
	  if(!S && typeof (fn = it.toString) == 'function' && !isObject(val = fn.call(it)))return val;
	  throw TypeError("Can't convert object to primitive value");
	};

/***/ },
/* 37 */
/***/ function(module, exports) {

	module.exports = function(bitmap, value){
	  return {
	    enumerable  : !(bitmap & 1),
	    configurable: !(bitmap & 2),
	    writable    : !(bitmap & 4),
	    value       : value
	  };
	};

/***/ },
/* 38 */
/***/ function(module, exports, __webpack_require__) {

	module.exports = { "default": __webpack_require__(39), __esModule: true };

/***/ },
/* 39 */
/***/ function(module, exports, __webpack_require__) {

	__webpack_require__(40);
	module.exports = parseInt;

/***/ },
/* 40 */
/***/ function(module, exports, __webpack_require__) {

	var $export   = __webpack_require__(24)
	  , $parseInt = __webpack_require__(41);
	// 20.1.2.13 Number.parseInt(string, radix)
	$export($export.S + $export.F * (Number.parseInt != $parseInt), 'Number', {parseInt: $parseInt});

/***/ },
/* 41 */
/***/ function(module, exports, __webpack_require__) {

	var $parseInt = __webpack_require__(20).parseInt
	  , $trim     = __webpack_require__(42).trim
	  , ws        = __webpack_require__(43)
	  , hex       = /^[\-+]?0[xX]/;

	module.exports = $parseInt(ws + '08') !== 8 || $parseInt(ws + '0x16') !== 22 ? function parseInt(str, radix){
	  var string = $trim(String(str), 3);
	  return $parseInt(string, (radix >>> 0) || (hex.test(string) ? 16 : 10));
	} : $parseInt;

/***/ },
/* 42 */
/***/ function(module, exports, __webpack_require__) {

	var $export = __webpack_require__(24)
	  , defined = __webpack_require__(7)
	  , fails   = __webpack_require__(34)
	  , spaces  = __webpack_require__(43)
	  , space   = '[' + spaces + ']'
	  , non     = '\u200b\u0085'
	  , ltrim   = RegExp('^' + space + space + '*')
	  , rtrim   = RegExp(space + space + '*$');

	var exporter = function(KEY, exec, ALIAS){
	  var exp   = {};
	  var FORCE = fails(function(){
	    return !!spaces[KEY]() || non[KEY]() != non;
	  });
	  var fn = exp[KEY] = FORCE ? exec(trim) : spaces[KEY];
	  if(ALIAS)exp[ALIAS] = fn;
	  $export($export.P + $export.F * FORCE, 'String', exp);
	};

	// 1 -> String#trimLeft
	// 2 -> String#trimRight
	// 3 -> String#trim
	var trim = exporter.trim = function(string, TYPE){
	  string = String(defined(string));
	  if(TYPE & 1)string = string.replace(ltrim, '');
	  if(TYPE & 2)string = string.replace(rtrim, '');
	  return string;
	};

	module.exports = exporter;

/***/ },
/* 43 */
/***/ function(module, exports) {

	module.exports = '\x09\x0A\x0B\x0C\x0D\x20\xA0\u1680\u180E\u2000\u2001\u2002\u2003' +
	  '\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000\u2028\u2029\uFEFF';

/***/ },
/* 44 */
/***/ function(module, exports) {

	module.exports = require("auth0-oauth2-express");

/***/ },
/* 45 */
/***/ function(module, exports) {

	module.exports = {
		"title": "OIE-Auth0 user update webhook",
		"name": "oie-auth0-user-webhook-1-9",
		"version": "1.9.0",
		"author": "OIEngine",
		"description": "Web hook for updating user profile on OIE side",
		"type": "cron",
		"logoUrl": "https://cdn.auth0.com/extensions/auth0-webhooks/assets/logo.svg",
		"repository": "https://github.com/oiengine/oie-auth0-user-update-webhook",
		"keywords": [
			"auth0",
			"extension"
		],
		"secrets": {
			"BATCH_SIZE": {
				"description": "The ammount of logs to be read on each execution. Maximun is 100.",
				"default": 100
			},
			"AUTH0_API_ENDPOINTS": {
				"description": "Allows you to filter specific API endpoints, comma separated.",
				"example": "e.g.: users, connections, rules, logs, emails, stats, clients, tenants",
				"default": "users"
			},
			"SIGN_UP_USER_WEBHOOK_URL": {
				"required": false
			},
			"UPDATE_USER_WEBHOOK_URL": {
				"required": false
			},
			"DELETE_USER_WEBHOOK_URL": {
				"required": false
			},
			"WEBHOOK_CONCURRENT_CALLS": {
				"description": "The maximum concurrent calls that will be made to your webhook",
				"default": 1
			},
			"AUTH0_APP_CLIENT_SECRET": {
				"description": "Secret id of application, it is used to create a JWT token",
				"required": true
			},
			"AUTH0_APP_CLIENT_ID": {
				"description": "Client id of application, it is used in filtering the logs, only logs from this application will be processed",
				"required": true
			},
			"AUTH0_TOKEN": {
				"description": "Security token with read:logs, read:users",
				"required": true
			}
		}
	};

/***/ },
/* 46 */
/***/ function(module, exports) {

	module.exports = require("superagent");

/***/ },
/* 47 */
/***/ function(module, exports) {

	module.exports = require("async");

/***/ },
/* 48 */
/***/ function(module, exports) {

	module.exports = require("express");

/***/ },
/* 49 */
/***/ function(module, exports, __webpack_require__) {

	const LRU        = __webpack_require__(50);
	const _          = __webpack_require__(51);
	const lru_params = [ 'max', 'maxAge', 'length', 'dispose', 'stale' ];

	module.exports = function (options) {
	  const cache   = new LRU(_.pick(options, lru_params));
	  const load    = options.load;
	  const hash    = options.hash;
	  const bypass  = options.bypass;
	  const loading  = new Map();

	  if (options.disable) {
	    return load;
	  }

	  const result = function () {
	    const args       = _.toArray(arguments);
	    const parameters = args.slice(0, -1);
	    const callback   = args.slice(-1).pop();
	    const self       = this;

	    var key;

	    if (bypass && bypass.apply(self, parameters)) {
	      return load.apply(self, args);
	    }

	    if (parameters.length === 0 && !hash) {
	      //the load function only receives callback.
	      key = '_';
	    } else {
	      key = hash.apply(self, parameters);
	    }

	    var fromCache = cache.get(key);

	    if (fromCache) {
	      return callback.apply(null, [null].concat(fromCache));
	    }

	    if (!loading.get(key)) {
	      loading.set(key, []);

	      load.apply(self, parameters.concat(function (err) {
	        const args = _.toArray(arguments);

	        //we store the result only if the load didn't fail.
	        if (!err) {
	          cache.set(key, args.slice(1));
	        }

	        //immediately call every other callback waiting
	        loading.get(key).forEach(function (callback) {
	          callback.apply(null, args);
	        });

	        loading.delete(key);
	        /////////

	        callback.apply(null, args);
	      }));
	    } else {
	      loading.get(key).push(callback);
	    }
	  };

	  result.keys = cache.keys.bind(cache);

	  return result;
	};


	module.exports.sync = function (options) {
	  const cache = new LRU(_.pick(options, lru_params));
	  const load = options.load;
	  const hash = options.hash;
	  const disable = options.disable;
	  const bypass = options.bypass;
	  const self = this;

	  if (disable) {
	    return load;
	  }

	  const result = function () {
	    var args = _.toArray(arguments);

	    if (bypass && bypass.apply(self, arguments)) {
	      return load.apply(self, arguments);
	    }

	    var key = hash.apply(self, args);

	    var fromCache = cache.get(key);

	    if (fromCache) {
	      return fromCache;
	    }

	    var result = load.apply(self, args);

	    cache.set(key, result);

	    return result;
	  };

	  result.keys = cache.keys.bind(cache);

	  return result;
	};


/***/ },
/* 50 */
/***/ function(module, exports) {

	module.exports = require("lru-cache");

/***/ },
/* 51 */
/***/ function(module, exports) {

	module.exports = require("lodash");

/***/ },
/* 52 */
/***/ function(module, exports) {

	module.exports = require("jsonwebtoken");

/***/ }
/******/ ]);