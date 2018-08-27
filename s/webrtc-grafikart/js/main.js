const bindEvents = (p) => {

    console.log('bindEvents called');

    p.on('error', (error) => console.log('bindEvents ERROR', error));

    p.on('signal', (data) => {

        console.log('bindEvents.signal called');
        document.querySelector('#offer').textContent = JSON.stringify(data);

    });

    p.on('stream', (stream) => {

        console.log('bindEvents.stream called');
        const receiverVideo = document.querySelector('#receiver-video');
        receiverVideo.srcObject = stream;
        receiverVideo.play();

    });

    document.querySelector('#incoming').addEventListener('submit', (ev) => {

        ev.preventDefault();

        const textareaValue = ev.target.querySelector('textarea').value;
        const existingSdpOffer = JSON.parse(textareaValue);
        p.signal(existingSdpOffer);

    })

};
const startPeer = (isInitiator) => {

    navigator.getUserMedia({
        video: true,
        audio: false
    }, (stream) => {

        const p = new SimplePeer({
            initiator: isInitiator,
            stream,
            trickle: false // ? ça fait quoi ?
        });

        bindEvents(p);

        const emitterVideo = document.querySelector('#emitter-video');
        emitterVideo.srcObject = stream;
        emitterVideo.play();

    }, (error) => console.log('ERROR', error));

}

document.querySelector('#start').addEventListener('click', (event) => {

    startPeer(true);

});

document.querySelector('#receive').addEventListener('click', (event) => {

    startPeer(false);

});
