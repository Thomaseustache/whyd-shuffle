var orig = $(".posts").children(); //caching original

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
        reorder();
      });
    });
  });
}
else{
  reorder();
}
window.playem.updateTracks();
$frame.ajaxify();
console.log('on');

function reorder() {
    var grp = $(".posts").children();
    var cnt = grp.length;

    var temp, x;
    for (var i = 0; i < cnt; i++) {
        temp = grp[i];
        x = Math.floor(Math.random() * cnt);
        grp[i] = grp[x];
        grp[x] = temp;
    }
    $(grp).remove();
    $(".posts").append($(grp));
    console.log('REORDER');
}

function orderPosts() {
    // set original order
    $(".posts").html(orig);
}