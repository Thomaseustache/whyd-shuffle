$('.buttons').append('<button id="shuffle" type="button" value="1">Shuffle</button>');

$('#shuffle').bind('click',shuffle);

function shuffle(){
  console.log('Shuffle Function');
  if($('#shuffle').hasClass('on')){
    randomNext = Math.floor(Math.random() * trackList.length) + 1;
    trackList[(currentTrack.index + randomNext) % trackList.length];
    console.log('OFF');
    $('#shuffle').removeClass('on');
  }
  else {
    console.log('ON');
    $('#shuffle').addClass('on');
  }
}