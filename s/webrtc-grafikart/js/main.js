let p = null;

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

    })

};

// peer A sends
document.querySelector('#start').addEventListener('click', (event) => {

    console.log('start clicked');

    navigator.getUserMedia({
        video: true,
        audio: false
    }, (stream) => {

        p = new SimplePeer({
            initiator: true,
            stream,
            trickle: false // ? ça fait quoi ?
        });

        bindEvents(p);

        const emitterVideo = document.querySelector('#emitter-video');
        emitterVideo.srcObject = stream;
        emitterVideo.play();

    }, (error) => console.log('ERROR', error));

});

// peer B receives
document.querySelector('#incoming').addEventListener('submit', (ev) => {

    ev.preventDefault();
    console.log('incoming clicked');

    if (p == null) {

        p = new SimplePeer({
            initiator: false,
            trickle: false
        });

        bindEvents(p);

    }

    const textareaValue = ev.target.querySelector('textarea').value;
    const existingSdpOffer = JSON.parse(textareaValue);
    p.signal(existingSdpOffer);

})