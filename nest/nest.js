module.exports = function(RED) {
    "use strict";
    var nest = require("request");
    var util = require("util");

    function NestNode(n) {
        RED.nodes.createNode(this,n);
    }
    RED.nodes.registerType("nest-config",NestNode,{
        credentials: {
            clientid: { type:"text" },
            clientsecret: { type: "text" },
            pin: { type:"password" },
            accesstoken: { type:"password" },
        }
    });

    function NestRequestNode(n) {
        RED.nodes.createNode(this,n);
        this.nestConfig = RED.nodes.getNode(n.account);
        var credentials = this.nestConfig.credentials;
        var device_type = n.devicetype;
        var device_id = n.deviceid;
        var streaming = n.streaming;
        var node = this;
        //var data;
        var nestheader = {};
        
        if (credentials.accesstoken) {
            node.on("input", function(msg) {
                var outmsg = { 
                    topic: msg.topic
                };
                var nesturl = 'https://developer-api.nest.com';
                switch(device_type) {
                    case 'thermostats':
                        nesturl = nesturl + '/devices/thermostats';
                        break;
                    case 'smoke_co_alarms':
                        nesturl = nesturl + '/devices/smoke_co_alarms';
                        break;
                    case 'structures':
                        nesturl = nesturl + '/structures';
                        break;
                    case 'cameras':
                        nesturl = nesturl + '/devices/cameras';
                        break;                        
                }
                if (device_id) {
                    nesturl = nesturl + '/' + device_id;
                }
                nesturl = nesturl + '?auth=' + credentials.accesstoken;
                if (streaming === "true") {
                    nestheader = { "Accept" : "text/event-stream" };
                    nest({ method: 'GET', url: nesturl, headers: nestheader })
                        .on('data', function(chunk) {
                            //util.log('[nest] ' + chunk);
                            var data;
                            try {
                                 data = JSON.parse( chunk );
                                 outmsg.payload = data;
                                 node.send(outmsg);  
                            } catch (e) {
                                 var esmsg = chunk.toString();
                                 var parts = esmsg.substr(0).split("\n"),
                                     eventType = 'message',
                                     //data = [],
                                     i = 0,
                                     line = '';
                                    
                                 for (; i < parts.length; i++) {
                                     line = parts[i].replace(/^(\s|\u00A0)+|(\s|\u00A0)+$/g, '');
                                     if (line.indexOf('event') == 0) {
                                       eventType = line.replace(/event:?\s*/, '');
                                     } else if (line.indexOf('data') == 0) {
                                       data = line.replace(/data:?\s*/, '');
                                     } 
                                 }
                                try {
                                    var jsonData = JSON.parse(data)
                                    if (jsonData && jsonData.path) {
                                        outmsg.topic = jsonData.path;
                                        outmsg.payload = jsonData.data;
                                    }
                                } catch (e) {
                                    console.log('[nest] ' + e);
                                    outmsg.error = e;
                                }
                                node.send(outmsg);
                            }
                        })
                        .on('error', function(error) {
                            console.log('[nest] ' + error);
                            //TODO: not sure how to send error downstream or for debug tab in node-red
                            outmsg.error = error;
                            node.send(outmsg);
                        }); 
                } else {
                    nest({ method: 'GET', url: nesturl, headers: nestheader }, function ( error, response, body ){
                        var data;
                        if ( util.isNullOrUndefined(body) ) {
                           console.log('[nest] Null or Undefined response body');
                        } else {
                            try {
                                data = JSON.parse( body );
                                outmsg.payload = data;
                                node.send(outmsg);  
                            } catch (e) {
                                console.log('[nest] caught the following error parsing response: ' + e);
                                var esmsg = body.toString();
                                var parts = esmsg.substr(0).split("\n"),
                                    eventType = 'message',
                                    data = [],
                                    i = 0,
                                    line = '';
                                    
                                for (; i < parts.length; i++) {
                                    line = parts[i].replace(/^(\s|\u00A0)+|(\s|\u00A0)+$/g, '');
                                    if (line.indexOf('event') == 0) {
                                      eventType = line.replace(/event:?\s*/, '');
                                    } else if (line.indexOf('data') == 0) {
                                      data = line.replace(/data:?\s*/, '');
                                    } 
                                }
                                // TODO parse out "path" and use for topic 
                                outmsg.payload = data;
                                node.send(outmsg);                          
                            }
                        }
                    });
                }
            });
        } 
    }
    RED.nodes.registerType("nest request",NestRequestNode);

    // a RED http endpoint (express really) to call to get around same origin browser restrictions
    RED.httpAdmin.get('/nest-credentials/:id/:cid/:csec/:pin/auth', function(req, res){
        // if the creds are good, try and exchange them for an access token
        if (  req.params.cid && req.params.csec && req.params.pin ) {
            // call nest API to exchange the one time code for an access token
            var url = 'https://api.home.nest.com/oauth2/access_token?client_id=' + req.params.cid + '&code=' + req.params.pin + '&client_secret=' + req.params.csec + '&grant_type=authorization_code'; 
            
            nest.post(url,function(error, response, body) {
                if (error){
                    util.log('[nest] Error in nest post: ' + error);
                    res.send("Error");
                } else if (response.statusCode == 400 || response.statusCode == 403) {
                    util.log('[nest] Unauthorized: ' + util.inspect(body) );
                    res.send("Unauthorised");
                } else {
                    //add access token to creds  
                    try {
                        var t = JSON.parse( body );
                        if ( t.access_token ) {
                            res.send(t.access_token);
                        } else {
                            util.log('[nest] no access token in JSON response' + util.inspect(t) );
                            res.send("Error");
                        }
                    } catch (e) {
                        console.log ( e );
                    }
                }
            });    
        } else{
            util.log('[nest] missing required creds, cannot auth');
            res.send("Error");
        }                    
    });

    function NestStatus(n) {
        RED.nodes.createNode(this,n);
        this.nestConfig = RED.nodes.getNode(n.account);
        var credentials = this.nestConfig.credentials;
        var node = this;
        var state = n.away;
        var sid = n.structure_id;

        this.on("input", function(msg) {
            var outmsg = {
                topic: msg.topic
            };
            var err = null;
            //static node config trumps incomming message parameters
            if ( !state && msg.payload.away ) { 
                state = msg.payload.away;
            }
            if ( !sid && msg.payload.structure_id ) {
                sid = msg.payload.structure_id;
            }
            //build URL and HTTP PUT form data
            var nesturl = 'https://developer-api.nest.com/structures/' + sid + '.json?auth=' + credentials.accesstoken;
            var nestheader = { "Accept" : "application/json" };
            var nestoptions = { 
                    method: 'PUT',
                    url: nesturl, 
                    followAllRedirects: true,
                    headers: nestheader, 
                    form: JSON.stringify({ "away": state })
            };
            console.log( nesturl );
            console.log( nestoptions );

            if ( (state == "home" || state == "away") && sid) {           
                // TODO - check proper error handling
                nest( nestoptions, function(error, response, body) {
                    if (error){
                        util.log('[nest] Error in nest post: ' + error);
                        outmsg.payload = error;
                        outmsg.error = 'Error on post to structure';
                    } else if (response.statusCode == 400 || response.statusCode == 403) {
                        util.log('[nest] Unauthorized PUT to structure' );
                        util.log('[nest] body =' + body );
                        outmsg.error = 'Unauthorized PUT to structure';
                        outmsg.payload = response.statusCode;
                    } else if (response.statusCode == 200) {
                        outmsg.payload = body;
                    } else {
                        util.log('[nest] Unexpected reponse ');
                        outmsg.error = 'Unknown response to post to structure';
                        outmsg.payload = response.statusCode;
                    }
                    node.send(outmsg);  
                });    
            } else {
                util.log('[nest] undefined away state and/or structure ID, skipping calls to nest');
                err = new Error("undefined away state");
                outmsg.payload = err;
                node.send(outmsg);  
            }
        });
    }
    RED.nodes.registerType("nest status",NestStatus);

   function NestSetTemp(n) {
        RED.nodes.createNode(this,n);
        this.nestConfig = RED.nodes.getNode(n.account);
        var credentials = this.nestConfig.credentials;
        var node = this;
        var tid = n.id;
        var target = Number(n.target);
        var scale = n.scale;
        var dynamic = target === 0;

        this.on("input", function(msg) {
            var outmsg = {
                topic: msg.topic
            };
            var err = null;
            //static node config trumps incomming message parameters
            //TODO check target_tempurature_? is a valid number and not a string
            var nestform = {};
            if ( scale == "c" && !dynamic ) {
                nestform.target_temperature_c = target;
            } else if ( scale == "f" && !dynamic ) {
                nestform.target_temperature_f = target;
            } else if ( msg.payload.target_temperature_c ) { 
                target = msg.payload.target_temperature_c;
                scale = "c";
                nestform.target_temperature_c = target;
            } else if ( msg.payload.target_temperature_f ) { 
                target = msg.payload.target_temperature_f;
                scale = "f";
                nestform.target_temperature_f = target;
            }

            if ( !tid && msg.payload.device_id ) {
                tid = msg.payload.device_id;
            }

            //build URL and HTTP PUT form data
            var nesturl = 'https://developer-api.nest.com/devices/thermostats/' + tid + '.json?auth=' + credentials.accesstoken;
            var nestheader = { "Accept" : "application/json" };

            console.log( nesturl );
            console.log( util.inspect(nestform) );

            
            if ( target && scale && tid) {           
                // TODO - check proper error handling
                nest( { 
                    method: 'PUT', //or PATCH maybe???
                    url: nesturl, 
                    headers: nestheader, 
                    form: JSON.stringify(nestform),
                    followAllRedirects: true
                }, function(error, response, body) {
                    if (error){
                        util.log('[nest] Error on set temp post: ' + error);
                        outmsg.payload = error;
                        outmsg.error = 'Error on set temp post';
                    } else if (response.statusCode == 400 || response.statusCode == 403) {
                        util.log('[nest] Client Error, status code = response.statusCode'  );
                        util.log('[nest] body =' + body );
                        outmsg.error = 'Client Error';
                        outmsg.payload = response.statusCode;
                    } else if (response.statusCode == 200) {
                        outmsg.payload = body;
                    } else {
                        util.log('[nest] Unexpected reponse' );
                        outmsg.error = 'Unknown response to post to structure';
                        outmsg.payload = response.statusCode;
                    }
                    node.send(outmsg);  
                });    
            } else {
                util.log('[nest] undefined target temp and/or device ID, skipping calls to nest');
                err = new Error("undefined temp or device");
                outmsg.payload = err;
                node.send(outmsg);  
            }
        });
    }
    RED.nodes.registerType("temp",NestSetTemp);
};
