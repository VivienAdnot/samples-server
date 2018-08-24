"use strict";
var connection = null;
var clientID = 0;

var WebSocket = WebSocket || MozWebSocket;

function setUsername() {
    var msg = {
        name: document.getElementById("name").value,
        date: Date.now(),
        id: clientID,
        type: "username"
    };
    connection.send(JSON.stringify(msg));
}

function connect() {
    console.log('fn connect called');
    //var serverUrl = "ws://" + window.location.hostname + ":6503";
    var serverUrl = "ws://localhost:6503";

    connection = new WebSocket(serverUrl);

    connection.onopen = function(evt) {
        console.log('client is now connected to server');
        document.getElementById("text").disabled = false;
        document.getElementById("send").disabled = false;
    };

    connection.onmessage = function(evt) {
        var f = document.getElementById("chatbox").contentDocument;
        var text = "";
        var msg = JSON.parse(evt.data);
        var time = new Date(msg.date);
        var timeStr = time.toLocaleTimeString();

        console.log('connection.onmessage before', msg);

        switch (msg.type) {
            case "id":
                clientID = msg.id;
                setUsername();
                break;
            case "username":
                text = "<b>User <em>" + msg.name + "</em> signed in at " + timeStr + "</b><br>";
                break;
            case "message":
                text = "(" + timeStr + ") <b>" + msg.name + "</b>: " + msg.text + "<br>";
                break;
            case "rejectusername":
                text = "<b>Your username has been set to <em>" + msg.name + "</em> because the name you chose is in use.</b><br>";
                break;
            case "userlist":
                /*var ul = "";
                var i;

                for (i = 0; i < msg.users.length; i++) {
                    ul += msg.users[i] + "<br>";
                }
                document.getElementById("userlistbox").innerHTML = ul;*/
                handleUserlistMsg(msg);
                break;
            case "video-offer":
                handleVideoOfferMsg(msg);
                break;
            case "video-answer":
                handleVideoAnswerMsg(msg);
                break;
            case "new-ice-candidate":
                handleNewIceCandidateMsg(msg);
                break;
        }

        if (text.length) {
            f.write(text);
            // todo scroll at bottom
            // document.getElementById("chatbox").contentWindow.scrollByPages(1);
        }
    };
}

function send() {
    var msg = {
        text: document.getElementById("text").value,
        type: "message",
        id: clientID,
        date: Date.now()
    };
    connection.send(JSON.stringify(msg));
    document.getElementById("text").value = "";
}

function handleKey(evt) {
    if (evt.keyCode === 13 || evt.keyCode === 14) {
        if (!document.getElementById("send").disabled) {
            send();
        }
    }
}

function sendToServer(msg) {
    var msgJSON = JSON.stringify(msg);
    connection.send(msgJSON);
}

function handleUserlistMsg(msg) {
    var i;
    var listElem = document.getElementById("userlistbox");

    while (listElem.firstChild) {
        listElem.removeChild(listElem.firstChild);
    }

    for (i = 0; i < msg.users.length; i++) {
        var item = document.createElement("li");
        item.appendChild(document.createTextNode(msg.users[i]));
        item.addEventListener("click", invite, false);

        listElem.appendChild(item);
    }
}

var mediaConstraints = {
    audio: true,
    video: true
};

var myPeerConnection = null;
var myUsername = null;
var targetUsername = null;

function invite(evt) {
    if (myPeerConnection) {
        alert("you can't start a call because you already have one open.");
    } else {
        const clickedUsername = evt.target.textContent;

        if (clickedUsername === myUsername) {
            alert("you can't talk to yourself.");
            return;
        }

        console.log('invite start');

        targetUsername = clickedUsername;

        createPeerConnection();

        navigator.mediaDevices.getUserMedia(mediaConstraints)
            .then((localStream) => {
                document.getElementById("local_video").srcObject = localStream;
                myPeerConnection.addStream(localStream);
            })
            .catch(handleGetUserMediaError);
    }
}

function handleGetUserMediaError(e) {
    console.log('handleGetUserMediaError');

    switch (e.name) {
        case "NotFoundError":
            alert("Unable to open your call because no camero and/or microphone found");
            break;
        case "SecurityError":
        case "PermissionDeniedError":
            // do nothing: this is the same as the user canceling the call.
            break;
        default:
            alert("Error opening your camera and/or microphone: " + e.message);
            break;
    }

    closeVideoCall();
}

function createPeerConnection() {
    console.log('createPeerConnection start');

    myPeerConnection = new RTCPeerConnection({
        iceServers: [{
            urls: 'turn:localhost',
            username: 'webrtc',
            credential: 'turnserver'
        }]
    });

    // the local ICE layer call your handler
    // when it needs you to transmit an ICE candidature to the other peer.
    // note: the ICE candidate event is NOT sent when ICE candidates arrive from the other end of the call.
    // Instead, they are sent by your own end of the call
    // so that you can take on the job of transmitting the data over whatever chanel you choose.
    myPeerConnection.onicecandidate = handleIceCandidateEvent;

    // called by the local WebRTC layer
    // when a track is added to the connection.
    // this lets you connect the incoming media to an element to display it.
    myPeerConnection.ontrack = handleTrackEvent;

    // this function is called whenever the WebRTC infrastructure needs you to
    // start the session negociation process anew.
    // Its job is to create and send an offer, to the callee,
    // asking it to connect with us.
    // to learn more: https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Signaling_and_video_calling#Starting_negotiation
    myPeerConnection.onnegotiationneeded = handleNegotiationNeededEvent;

    // it's sent to the RTCPeerConnection
    // when the remote peer removes a track from the media being set.
    myPeerConnection.onremovetrack = handleRemoveTrackEvent;

    // sent by the ICE layer to let you know about
    // changes to the state of the ICE connection.
    myPeerConnection.oniceconnectionstatechange = handleIceConnectionStateChangeEvent;

    // the WebRTC infrastructure sends you the signalingstatechange message
    // when the state of the signaling process changes
    // or if the connection to the signaling server changes.
    // to learn more: https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Signaling_and_video_calling#Signaling_state
    myPeerConnection.onsignalingstatechange = handleSignalingStateChangeEvent;

}

function handleNegotiationNeededEvent() {
    console.log('handleNegotiationNeededEvent start');

    myPeerConnection.createOffer()
        .then((offer) => {
            // once setLocalDescription's fulfillment handler has run,
            // the ICE agent begins sending icecandidate events to the RTCPeerConnection,
            // one for each potential configuration it discovers.
            // our handler for the icecandidate event is responsible for transmitting the candidates to the other peer.
            return myPeerConnection.setLocalDescription(offer);
        })
        .then(() => {
            sendToServer({
                name: myUsername,
                target: targetUsername,
                type: 'video-offer',
                sdp: myPeerConnection.localDescription
            });
        })
        .catch((error) => console.log('handleNegotiationNeededEvent error', error));
}

// when the offer arrives, the callee's handleVideoOfferMsg function is called with the "video-offer" message that was received.
// this function does 2 things:
// 1 - it needs to create its own RTCPeerConnection and add the tracks containing the audio and video from its microphone and webcam to that.
// 2 - it needs to process the received offer, constructing and sending its answer
function handleVideoOfferMsg(msg) {
    console.log('handleVideoOfferMsg start');

    var localStream = null;

    targetUsername = msg.name;
    createPeerConnection();

    var desc = new RTCSessionDescription(msg.sdp);

    myPeerConnection.setRemoteDescription(desc)
    .then(() => {
        return navigator.mediaDevices.getUserMedia(mediaConstraints);
    })
    .then((stream) => {
        localStream = stream;
        document.getElementById('local_video').srcObject = localStream;

        localStream.getTracks()
        .forEach(track => myPeerConnection.addTrack(track, localStream));
    })
    .then(() => {
        return myPeerConnection.createAnswer();
    })
    .then((answer) => {
        return myPeerConnection.setLocalDescription(answer);
    })
    .then(() => {
        var msg = {
            name: myUsername,
            target: targetUsername,
            type: 'video-answer',
            sdp: myPeerConnection.localDescription
        };

        sendToServer(msg);
    })
    .catch(handleGetUserMediaError);
}

function handleVideoAnswerMsg(msg) {
    console.log('handleVideoAnswerMsg start');

    //var localStream = null;

    //targetUsername = msg.name;
    //createPeerConnection();

    var desc = new RTCSessionDescription(msg.sdp);

    myPeerConnection.setRemoteDescription(desc)
    .then(() => console.log('handleVideoAnswerMsg success'))
    // .then(() => {
    //     return navigator.mediaDevices.getUserMedia(mediaConstraints);
    // })
    // .then((stream) => {
    //     localStream = stream;
    //     document.getElementById('local_video').srcObject = localStream;

    //     localStream.getTracks()
    //     .forEach(track => myPeerConnection.addTrack(track, localStream));
    // })
    // .then(() => {
    //     return myPeerConnection.createAnswer();
    // })
    // .then((answer) => {
    //     return myPeerConnection.setLocalDescription(answer);
    // })
    // .then(() => {
    //     var msg = {
    //         name: myUsername,
    //         target: targetUsername,
    //         type: 'video-answer',
    //         sdp: myPeerConnection.localDescription
    //     };

    //     sendToServer(msg);
    // })
    .catch((error) => console.log('handleVideoAnswerMsg ERROR', error));
}

function handleIceCandidateEvent(event) {
    console.log('handleIceCandidateEvent start');

    if (event.candidate) {
        sendToServer({
            type: 'new-ice-candidate',
            target: targetUsername,
            candidate: event.candidate
        });
    }
}

function handleNewIceCandidateMsg(msg) {
    console.log('handleNewIceCandidateMsg start');

    // pass the received SDP to the constructor
    var candidate = new RTCIceCandidate(msg.candidate);

    // delivers the candidate to the ICE layer
    myPeerConnection.addIceCandidate(candidate)
    .catch((error) => console.log('handleNewIceCandidateMsg error', error));
}

function handleTrackEvent(event) {
    document.getElementById("received_video").srcObject = event.streams[0];
    document.getElementById("hangup-button").disabled = false;
}

function handleRemoveTrackEvent(event) {
    var stream = document.getElementById("received_video").srcObject;
    var trackList = stream.getTracks();

    if (!trackList.length) {
        closeVideoCall();
    }
}

function hangUpCall() {
    console.log('hangUpCall start');

    closeVideoCall();
    sendToServer({
        name: myUsername,
        target: targetUsername,
        type: 'hang-up'
    });
}

function closeVideoCall() {
    console.log('closeVideoCall start');

    var remoteVideo = document.getElementById('received_video');
    var localVideo = document.getElementById('local_video');

    if (myPeerConnection) {
        myPeerConnection.ontrack = null;
        myPeerConnection.onremovetrack = null;
        myPeerConnection.onicecandidate = null;
        myPeerConnection.oniceconnectionstatechange = null;
        myPeerConnection.onsignalingstatechange = null;
        myPeerConnection.onicegatheringstatechange = null;
    }

    if (remoteVideo.srcObject) {
        remoteVideo.srcObject.getTracks()
        .forEach(track => track.stop());
    }

    if (localVideo.srcObject) {
        localVideo.srcObject.getTracks()
        .forEach(track => track.stop());
    }

    myPeerConnection.close();
    myPeerConnection = null;

    remoteVideo.removeAttribute('src');
    remoteVideo.removeAttribute('srcObject');
    localVideo.removeAttribute('src');
    localVideo.removeAttribute('srcObject');

    document.getElementById('hangup-button').disabled = true;
    targetUsername = null;
}

function handleIceConnectionStateChangeEvent(event) {
    console.log('handleIceConnectionStateChangeEvent start');

    switch(myPeerConnection.iceConnectionState) {
        case "closed":
        case "failed":
        case "disconnected":
            closeVideoCall();
            break;
    }
}

function handleSignalingStateChangeEvent(event) {
    console.log('handleSignalingStateChangeEvent start');

    switch(myPeerConnection.signalingState) {
        case "closed":
            closeVideoCall();
            break;
    }
}