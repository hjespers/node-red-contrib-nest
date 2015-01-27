node-red-contrib-nest
=====================

Node-Red (http://nodered.org) nodes for communicating with Nest thermostats and smoke detectors. 
This is still a work in progress so there are UI bugs and the automation of the OAUTH2 token 
generation process needs improvement. 


#Install

Run the following command in the root directory of your Node-RED install

npm install node-red-contrib-nest

You will need a Nest device and a <A HREF="https://developer.nest.com">Nest Developer Program</A> account.

Login to the Nest developer portal and create a client app (i.e. Node-Red), choosing which types of data you wish to make available for read and/or write.

From here on in this install is more complicated than it needs to be. This is temporary and will be replaced by an automated process once I setup a GUI config dialog in Node-Red. In the meantime...

Complete the client registration forms, leaving the Redirect URI blank.

Follow steps 1 - 3 outlined on the <A HREF="https://developer.nest.com/documentation/cloud/how-to-auth#credentials">How to set up Authorization</A> page of the nest developer portal to generate a PINCODE and exchange it for an access token. Step three can be executed from the command line using the following curl command:

    curl -X POST "https://api.home.nest.com/oauth2/access_token?client_id=YOUR_CLIENT_ID&code=YOUR_PINCODE&client_secret=YOUR_CLIENT_SECRET&grant_type=authorization_code"

Put the access token into the Node-Red nest config when prompted.


#Usage

The nest node will appear in it's own "Nest" catagory on the Node-Red pallet. Drag and drop it onto the canvas and configure as you would any other node-red module with both input and output.

#Disclaimer

Use these programs at your own risk. The author does not guaranteed the proper functioning of these applications. 

# Author

Hans Jespersen, https://github.com/hjespers

#Feedback and Support

For more information, feedback, or community support see the Node-Red Google groups forum at https://groups.google.com/forum/#!forum/node-red
