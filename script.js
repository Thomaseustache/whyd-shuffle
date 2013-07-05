$('.buttons').append('<button id="shuffle" type="button" value="1">Shuffle</button>');

$('#shuffle').bind('click',shuffle);

function shuffle(){
  var $button = $(".btnLoadMore:visible");
  if ($button.length){
    console.log('loadmore');
    console.log(window.nextPageUrl);
    
    $button.find("div").addClass("loading");
    var $frame = $button.parent();
    $frame.ready(function() {
      $.get(window.nextPageUrl+'&limit=9999', function(data) {
        $button.remove();
        $frame.append(data).ready(function() {
          window.playem.updateTracks();
          $(this).ajaxify();
        });
      });
    });
    
    // window.playem.updateTracks();
    // $(this).ajaxify();
  }
  else{
    console.log('full');
  }
  console.log('on');
}