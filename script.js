var orig = $(".posts").children('.post'); //caching original

var $button = $(".btnLoadMore:visible");
if ($button.length){
  console.log(window.nextPageUrl);
  
  $button.find("div").addClass("loading");
  var $frame = $button.parent();
  $frame.ready(function() {
    $.get(window.nextPageUrl+'&limit=9999', function(data) {
      $button.remove();
      $frame.append(data).ready(function() {
        reorder();
      });
    });
  });
}
else{
  reorder();
}
window.playem.updateTracks();
$(".posts").ajaxify();


function reorder(){
  var grp = $(".posts").children('.post');
  var cnt = grp.length;
  $(".posts").fadeOut(300);
  if($('.et-randomized-markup').length==0){
    $(".posts").before('<div class="et-randomized-markup" style="text-align:center; color:#ccc; padding:5px; marginBottom:10px;">Randomized by Thomas Eustache ♫ </div>');
  }
  grp.each(function(i){
    console.log(i);
    newPos = getRand(cnt, 0);
    console.log(newPos);
    // oTop = $(".post").eq(newPos).offset().top;
    $(".post").eq(newPos).after($(this));
    // $(this).remove();
    // $(this).css({'position':'absolute'});
    // $(this).animate({'top':oTop},2000, function(){
      // $(this).css({'position':'static'});
    // });
    $(this).delay(i*200).fadeIn(200);
  });
  
}

function orderPosts() {
    // set original order
    $(".posts").html(orig);
}
function getRand(max, min){
   var rand;
    rand = Math.floor(Math.random() * (max - min + 1) + min);

  return rand;
}