$('.buttons').append('<button id="shuffle" type="button" value="1">Shuffle</button>');

$('#shuffle').bind('click',shuffle);

function shuffle(){
  console.log('Shuffle Function');
  if($('#shuffle').val()=="1"){
    window.playem.next();
    console.log('OFF');
    $('#shuffle').val()="0";
  }
  else {
    console.log('ON');
    $('#shuffle').val()="1";
  }
}