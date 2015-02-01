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
        var data;
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
                }
                if (device_id) {
                    nesturl = nesturl + '/' + device_id;
                }
                nesturl = nesturl + '?auth=' + credentials.accesstoken;
                if (streaming === "true") {
                    nestheader = { "Accept" : "text/event-stream" };
                }
                nest({ method: 'GET', url: nesturl, headers: nestheader })
                    .on('data', function(chunk) {
                        util.log('[nest] ' + chunk);
                        try {
                            data = JSON.parse( chunk );
                            outmsg.payload = data;
                            node.send(outmsg);  
                        } catch (e) {
                            var esmsg = chunk.toString();
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

                            console.log( eventType );
                            console.log( data );
                            // TODO parse out "path" and use for topic 
                            outmsg.payload = data;
                            node.send(outmsg);                           
                        }
                    })
                    .on('response', function(response) {
                        util.log('[nest] Nest response status = ' + response.statusCode);
                    })
                    .on('error', function(error) {
                        util.log('[nest] on error: ' + error);
                    }); 
            });
        } 
    }

    RED.nodes.registerType("nest request",NestRequestNode);

    // a RED http endpoint (express really) to call to get around same origin browser restrictions
    RED.httpAdmin.get('/nest-credentials/:id/:cid/:csec/:pin/auth', function(req, res){
        var creds = {};
        // if the creds are good, try and exchange them for an access token
        if (  req.params.cid && req.params.csec && req.params.pin ) {
            // call nest API to exchange the one time code for an access token
            var url = 'https://api.home.nest.com/oauth2/access_token?client_id=' + req.params.cid + '&code=' + req.params.pin + '&client_secret=' + req.params.csec + '&grant_type=authorization_code'; 
            
            nest.post(url,function(error, response, body) {
                if (error){
                    console.log('Error in nest post: ' + error);
                    res.send("Error");
                } else if (response.statusCode == 400 || response.statusCode == 403) {
                    console.log('Unauthorized: ' + util.inspect(body) );
                    res.send("Unauthorised");
                } else {
                    //add access token to creds  
                    try {
                        var t = JSON.parse( body );
                        if ( t.access_token ) {
                            res.send(t.access_token);
                        } else {
                            console.log('no access token in JSON response' + util.inspect(t) );
                            res.send("Error");
                        }
                    } catch (e) {
                        console.log ( e );
                    }
                }
            });    
        } else{
            console.log('missing required creds, cannot auth');
            res.send("Error");
        }                    
    });
};
