node-red-contrib-nest
=====================

Node-Red (http://nodered.org) nodes for communicating with Nest thermostats and smoke detectors. 
Allows you to query as well as set parameters including target temperatures and home/away status.


#Install

Run the following command after you have done a global install of Node-RED

	sudo npm install -g node-red-contrib-nest

You will need a Nest device and a <A HREF="https://developer.nest.com">Nest Developer Program</A> account.

Login to the Nest developer portal and create a client app (i.e. Node-Red), choosing which types of data you wish to make available for read and/or write.

Complete the Nest Developer client app registration forms, leaving the Redirect URI blank to enable the PIN CODE authentication process.

#Usage

The nest node will appear in it's own "Nest" catagory on the Node-Red pallet. Drag and drop it onto the canvas and configure as you would any other node-red module with both input and output. 

The nest node allows you to select the type of device (thermostat or smoke/CO detector) or structure that you want to query. If the ID field is blank it will return all devices or structures on the account.

The nest node allows you to select "streaming" mode. When streaming is true, the nest node will continuously send messages out whenever there is a change in the data on the device. The nest also sends "null" heartbeat messages every 30 seconds to indicate the connection is still up. If streaming is false, then it acts as a one time request response and emits only one output message for each input message. 

#Disclaimer

Use these programs at your own risk. The author does not guaranteed the proper functioning of these applications. 

# Author

Hans Jespersen, https://github.com/hjespers

#Feedback and Support

For more information, feedback, or community support see the Node-Red Google groups forum at https://groups.google.com/forum/#!forum/node-red
