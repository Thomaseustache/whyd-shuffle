$('.buttons').append('<button id="shuffle" type="button" value="1">Shuffle</button>');

$('#shuffle').bind('click',shuffle);

function shuffle(){
  var $btnLoadMore = $(".btnLoadMore:visible");
  if ($btnLoadMore.length){
    console.log('loadmore');
    console.log(window.nextPageUrl);
    // window.playem.updateTracks();
    // $(this).ajaxify();
  }
  else{
    console.log('full');
  }
  console.log('on');
}