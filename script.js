$('.buttons').append('<button id="shuffle" type="button" value="1">Shuffle</button>');

$('#shuffle').bind('click',shuffle);

function shuffle(){
    randomNext = Math.floor(Math.random() * trackList.length) + 1;
    trackList[(currentTrack.index + randomNext) % trackList.length];
    console.log('on');
}