/**
 * whyd player, source code borrowed from play'em bookmarklet (playem.org)
 * @author adrienjoly
 **/

// configuration

var USE_SWFOBJECT = true; // ... to embed youtube flash player
var USE_FLASH_VIMEO = true; // ... or "universal embed" (iframe), if false

// utility functions

if (undefined == window.console) 
	console = {log:function(){}};

function Loader() {
	var yetToLoad = 0, remainingIncludes = {};
	var whenReady = [];
	return {
		includeJS: function(src, cb){
			if (remainingIncludes[src]) return;
			remainingIncludes[src] = true;
			++yetToLoad;
			//console.log("loading", src, "...");
			var inc = document.createElement("script");
			inc.onload = inc.onreadystatechange = function(a) {
				//console.log("state change", src, inc.readyState);
				if (!remainingIncludes[src] || (inc.readyState && inc.readyState != "loaded" && inc.readyState != "complete" && inc.readyState != 4))
					return;
				//console.log("loaded", src, yetToLoad);
				if (cb)
					cb();
				delete remainingIncludes[src];
				if (--yetToLoad == 0)
					for (var i in whenReady)
						(whenReady.pop())();
			};
			inc.src = src;
			document.getElementsByTagName("head")[0].appendChild(inc);
		},
		whenReady: function(fct) {
			if (yetToLoad < 1)
				fct();
			else
				whenReady.push(fct);
		}
	};
}

var loader = new Loader();

// message handling

var messageHandlers = {};

function onMessageReceived(e) {
	//console.log("onMessageReceived", e.origin, e.data, e);
	for (var origin in messageHandlers)
		if (e.origin.indexOf(origin) != -1) {//(e.origin.match(regex))
			var data = e.data;
			try { data = JSON.parse(e.data); } catch (e) { console.log(e.stack); }
			messageHandlers[origin](data, e);
		}
}
if (window.addEventListener)
	window.addEventListener('message', onMessageReceived, false);
else
	window.attachEvent('onmessage', onMessageReceived, false);

// track providers

//loader.includeJS("https://w.soundcloud.com/player/api.js");

if (USE_SWFOBJECT)
	loader.includeJS("/js/swfobject.js");

VimeoPlayer = (function() {

	var EVENT_MAP = {
		"play": "onPlaying",
		"resume": "onPlaying",
		"pause": "onPaused",
		"finish": "onEnded",
		"playProgress": function(that, e) { // Html5 event
			that.trackInfo = {
				duration: Number(e.data.duration),
				position: Number(e.data.seconds)
			};
			that.eventHandlers.onTrackInfo && that.eventHandlers.onTrackInfo(that.trackInfo);
		},
		"progress": function(that, seconds) { // Flash event
			that.trackInfo = {
				duration: Number(that.element.api_getDuration()),
				position: Number(seconds)
			};
			that.eventHandlers.onTrackInfo && that.eventHandlers.onTrackInfo(that.trackInfo);
		}
	};

	function VimeoPlayer(eventHandlers, embedVars) {  
		this.label = 'Vimeo';
		this.element = null;
		this.eventHandlers = eventHandlers || {};
		this.embedVars = embedVars || {};
		this.isReady = false;
		this.trackInfo = {};
		var that = this;
		
		if (!USE_FLASH_VIMEO) {
			function onMessageReceived(e) {
				//console.log("onMessageReceived", e, e.origin, e.data);
				try {
					var data = JSON.parse(e.data);
					if (data.player_id == that.embedVars.playerId) {
						//console.log("VIMEO EVENT", data);
						if (data.event == "ready")
							for (var i in EVENT_MAP)
								that.post('addEventListener', i);
						else
							(eventHandlers[EVENT_MAP[data.event]] || EVENT_MAP[data.event])(that, data);
					}
				} catch (e) {
					console.log("VimeoPlayer error", e, e.stack);
				}
			}
			if (window.addEventListener)
				window.addEventListener('message', onMessageReceived, false);
			else
				window.attachEvent('onmessage', onMessageReceived, false);
		}
		
		//loader.includeJS("http://a.vimeocdn.com/js/froogaloop2.min.js", function() {
			setTimeout(function() {
				that.isReady = true;
				eventHandlers.onApiLoaded && eventHandlers.onApiLoaded(that);
				eventHandlers.onApiReady && eventHandlers.onApiReady(that);
			}, 500);
		//});
	}

	VimeoPlayer.prototype.post = USE_FLASH_VIMEO ? function(action, value) {
		if (!this.element)
			return console.log("warning: this.element not found");
		if (!this.element["api_"+action])
			return console.log("warning: action not found:", "api_"+action);
		try {
			if (value != undefined)
				this.element["api_"+action](value);
			else
				this.element["api_"+action]();
		} catch (e) {
			console.log("vimeo api error", e, e.stack);
		}
	} : function(action, value) { // HTML 5 VERSION
		var data = { method: action };
		if (value)
			data.value = value;
		this.element.contentWindow.postMessage(JSON.stringify(data), this.element.src.split("?")[0]);
	}

	VimeoPlayer.prototype.getEid = function(url, cb) {
		var matches = /https?:\/\/(?:www\.)?vimeo\.com\/(clip\:)?(\d+)/.exec(url);
		cb(matches ? matches.pop() : null, this);
	}

	VimeoPlayer.prototype.setTrackPosition = function(pos) {
		this.post("seekTo", pos);
	};
	
	VimeoPlayer.prototype.embed = function(vars) {

		//console.log("VimeoPlayer embed vars:", vars);
		this.embedVars = vars = vars || {};
		this.embedVars.playerId = this.embedVars.playerId || 'viplayer';
		this.trackInfo = {};
		/*
		this.element = document.createElement(USE_FLASH_VIMEO ? "object" : "iframe");
		*/
		//this.embedVars.playerContainer.appendChild(this.element);

		this.holder = document.createElement("div");
		this.holder.id = "genericholder";
		/*
		this.holder.appendChild(this.element);
		*/
		this.embedVars.playerContainer.appendChild(this.holder);

		if (USE_FLASH_VIMEO) {
			// inspired by http://derhess.de/vimeoTest/test.html
			var that = this;
			window.vimeoHandlers = {};
			function setHandlers () {
				for (var evt in EVENT_MAP) 
					(function(evt){
						vimeoHandlers[evt] = function(data) {
							//console.log("vimeo event", evt, '=> on'+evt[0].toUpperCase()+evt.substr(1));
							(that.eventHandlers[EVENT_MAP[evt]] || EVENT_MAP[evt])(that, data);
						};
						that.element.api_addEventListener('on'+evt[0].toUpperCase()+evt.substr(1), "vimeoHandlers." + evt);
					})(evt);
				if (/*!this.isReady &&*/ this.eventHandlers.onEmbedReady)
					this.eventHandlers.onEmbedReady();
				//this.isReady = true;				
			}

			var flashvars = {
				server: 'vimeo.com',
				player_server: 'player.vimeo.com',
				api_ready: 'vimeo_ready',
				player_id: this.embedVars.playerId,
				clip_id: vars.videoId,
				title: 0,
				byline: 0,
				portrait: 0,
				fullscreen: 0,
				autoplay: 1,
				js_api: 1
			};

			var $object; // = $(this.element);
			
			// CHROME: ready called from here
			var embedAttrs = {
			//	id: this.embedVars.playerId,
				src: 'http://vimeo.com/moogaloop.swf?' + $.param(flashvars).replace(/\&/g, "&amp;"), // 'http://a.vimeocdn.com/p/flash/moogaloop/5.2.42/moogaloop.swf?v=1.0.0'
				type: 'application/x-shockwave-flash',
				classid: "clsid:D27CDB6E-AE6D-11cf-96B8-444553540000",
				allowscriptaccess: "always",
				width: this.embedVars.height || '200',
				height: this.embedVars.width || '200'
			};
			//var $embed = $("<embed>").attr(embedAttrs);
			////$embed.appendTo($object);
			
			window.vimeo_ready = function() {
				console.log("vimeo embed is ready (embed element)");
				$object.attr("id", "");
				$embed.attr("id", that.embedVars.playerId);
				that.element = document.getElementById(that.embedVars.playerId);
				setHandlers();
			}
			window.vimeo_ready_object = function() {
				console.log("vimeo embed is ready (object element)");
				// => nothing to do
				setHandlers();
			}

			//flashvars.api_ready = 'vimeo_ready_param';
			flashvars.api_ready = 'vimeo_ready_object';

			// IE9: ready called from here
			var params = {
				AllowScriptAccess: "always",
				WMode: "opaque",
				FlashVars: $.param(flashvars).replace(/\&/g, "&amp;"),
				Movie: "http://vimeo.com/moogaloop.swf?" + $.param(flashvars) //"http://a.vimeocdn.com/p/flash/moogaloop/5.2.42/moogaloop.swf?v=1.0.0&amp;time=1350388628283"
			};

			var innerHTML = "";
			for (var i in params) {
				//console.log('<param name="'+i.toLowerCase()+'" value="'+params[i]+'">')
				innerHTML += '<param name="'+i.toLowerCase()+'" value="'+params[i]+'">';
				//$object.append($('<param name="'+i.toLowerCase()+'" value="'+params[i]+'">'));
					//.append('<PARAM NAME="'+i+'" VALUE="'+params[i].replace("&", "&amp;")+'">');
			}

			var objectAttrs = {
				id: this.embedVars.playerId,
				src: 'http://vimeo.com/moogaloop.swf?' + $.param(flashvars).replace(/\&/g, "&amp;"), // 'http://a.vimeocdn.com/p/flash/moogaloop/5.2.42/moogaloop.swf?v=1.0.0'
			//	data: 'http://vimeo.com/moogaloop.swf?' + $.param(flashvars), // 'http://a.vimeocdn.com/p/flash/moogaloop/5.2.42/moogaloop.swf?v=1.0.0'
				type: 'application/x-shockwave-flash',
				classid: "clsid:D27CDB6E-AE6D-11cf-96B8-444553540000",
				allowscriptaccess: "always",
				width: this.embedVars.height || '200',
				height: this.embedVars.width || '200'
			};

			var objectHtml = "";
			for (var i in objectAttrs)
				objectHtml += i + '="' + objectAttrs[i] + '" ';

			//$embed.appendTo($object); // needed by chrome
			innerHTML += "<embed ";
			for (var i in embedAttrs)
				innerHTML += i + '="' + embedAttrs[i] + '" ';			
			innerHTML += "></embed>"
			this.holder.innerHTML = "<object "+objectHtml+">" + innerHTML + "</object>";

			this.element = document.getElementById(this.embedVars.playerId);
			$object = $(this.element);
			var $embed = $("#"+this.embedVars.playerId + " > embed");

			$object.show();
		}
		else { // "universal embed" (iframe)
			var strParams = {
				api: 1,
				js_api: 1,
				player_id: this.embedVars.playerId,
				title: 0,
				byline: 0,
				portrait: 0,
				autoplay: 1
			};
			$(this.element).attr({
				id: this.embedVars.playerId,
				width: this.embedVars.height || '200',
				height: this.embedVars.width || '200',
				frameborder: "0",
				webkitAllowFullScreen: true,
				mozallowfullscreen: true,
				allowScriptAccess: "always",
				allowFullScreen: true,
				src: 'http://player.vimeo.com/video/' + vars.videoId + "?" + $.param(strParams)
			}).show();
			if (/*!this.isReady &&*/ this.eventHandlers.onEmbedReady)
				this.eventHandlers.onEmbedReady();
			//this.isReady = true;
		}
	}

	VimeoPlayer.prototype.play = function(id) {
		if (id && (!this.currentId || this.currentId != id)) {
			this.embedVars.videoId = id;
			this.embed(this.embedVars);
		}
	}

	VimeoPlayer.prototype.resume = function() {
		this.post("play");
	}

	VimeoPlayer.prototype.pause = function() {
		this.post("pause");
	}

	VimeoPlayer.prototype.stop = function() {
		//this.post("pause");
		this.post("unload");
		//$(this.element).remove();
	}

	VimeoPlayer.prototype.setVolume = function(vol) {
		this.post("setVolume", 100 * vol);
	}

	return VimeoPlayer;
})();




AudioFilePlayer = (function() {

	/*
	loader.includeJS("/js/soundmanager2.js", function() { //-nodebug-jsmin
		console.log("loaded mp3 player");
		//eventHandlers.onApiLoaded && eventHandlers.onApiLoaded();
		soundManager.setup({
			url: '/swf/', //sound manager swf directory
			flashVersion: 9,
			onready: function() {
				console.log("mp3 player is ready");
				//that.isReady = true;
				soundManager.isReady = true;
				//eventHandlers.onApiReady && eventHandlers.onApiReady(that);
			}
		});
	});
	*/

	var EVENT_MAP = {
		"onplay": "onPlaying",
		"onresume": "onPlaying",
		"onpause": "onPaused",
		"onstop": "onPaused",
		"onfinish": "onEnded"
	};

	function AudioFilePlayer(eventHandlers, embedVars) {  
		this.label = 'Audio file';
		this.eventHandlers = eventHandlers || {};
		this.embedVars = embedVars || {};
		this.element = null;
		this.widget = null;
		this.isReady = false;
		this.trackInfo = {};
		var that = this;

		this.soundOptions = {
			id: null,
			url: null,
			autoLoad: true,
			autoPlay: true,
			ontimeout: function(e) {
				console.log("AudioFilePlayer timeout event:", e);
				if (that.eventHandlers.onError)
					that.eventHandlers.onError(that);
			}
		};

		for (var i in EVENT_MAP)
			(function(i) {
				that.soundOptions[i] = function() {
					console.log("event:", i, this);
					var handler = eventHandlers[EVENT_MAP[i]];
					handler && handler(that);
				}
			})(i);

		var loading = setInterval(function(){
			try {
				if (soundManager && soundManager.isReady) {
					clearInterval(loading);
					console.log("soundManager is ready");
					that.isReady = true;
					//setTimeout(function() {
						eventHandlers.onApiLoaded && eventHandlers.onApiLoaded();
						eventHandlers.onApiReady && eventHandlers.onApiReady(that);
					//}, 100);
				}
			}
			catch (e) {
				console.log("AudioFilePlayer error", e, e.stack);
			};
		}, 200);
	}

	AudioFilePlayer.prototype.getEid = function(url, cb) {
		var url = (url || "").split("#").pop();
		if (!url)
			return cb(null, this);
		var ext = url.split("#").pop().toLowerCase().split(".").pop().toLowerCase();
		if (ext == "mp3" || ext == "ogg")
			cb(url, this);
		else
			cb(null, this);
	}
	
	AudioFilePlayer.prototype.getTrackInfo = function(callback) {
		var that = this;
		var i = setInterval(function() {
			console.log("info", that.widget.duration)
			if (that.widget && that.widget.duration) {
				clearInterval(i);
				callback(that.widget);
				//that.eventHandlers.onTrackInfo && that.eventHandlers.onTrackInfo(that.widget);
			}
		}, 500);
	}

	AudioFilePlayer.prototype.getTrackPosition = function(callback) {
		//console.log("position", that.widget.position)
		if (this.widget && this.widget.position) {
			callback(this.widget.position / 1000);
			if (this.widget.durationEstimate /*&& this.widget.durationEstimate/1000 != that.widget.duration*/) {
				this.eventHandlers.onTrackInfo && this.eventHandlers.onTrackInfo({
					duration: this.widget.duration / 1000
				});
			}
			/*
			var e = this.widget;
			var kbLoaded = Math.floor(e.bytesLoaded / 1000);
          	var kbTotal = Math.floor(e.bytesTotal / 1000);
          	var durationEstimate = Math.floor(this.durationEstimate / 1000);
          	*/
		}
	};
	
	AudioFilePlayer.prototype.setTrackPosition = function(pos) {
		this.widget && this.widget.setPosition(pos * 1000);
	};
	
	AudioFilePlayer.prototype.embed = function(vars) {
		if (!vars || !vars.trackId)
			return;
		console.log("AudioFilePlayer embed vars:", vars);
		this.embedVars = vars = vars || {};
		this.soundOptions.id = vars.playerId = vars.playerId || 'mp3Player' + (new Date()).getTime();
		this.soundOptions.url = vars.trackId;
		this.trackInfo = {};
		if (this.widget) {
			this.pause();
			this.widget = null;
			delete this.widget;
		}
		console.log("-> soundManager parameters", this.soundOptions);
		this.widget = soundManager.createSound(this.soundOptions);
		console.log("-> soundManager instance", !!this.widget);
		this.eventHandlers.onEmbedReady && this.eventHandlers.onEmbedReady(this);
		this.eventHandlers.onTrackInfo && this.getTrackInfo(this.eventHandlers.onTrackInfo);
		this.play();
	}

	AudioFilePlayer.prototype.play = function(id) {
		//console.log("mp3 play", id)
		this.isReady && this.embed({trackId:id});
	}

	AudioFilePlayer.prototype.resume = function() {
		this.isReady && this.widget && this.widget.resume();
	}

	AudioFilePlayer.prototype.pause = function() {
		try {
			this.isReady && this.widget && this.widget.pause();
		}
		catch(e) {
			console.log(e.stack);
		}
	}

	AudioFilePlayer.prototype.stop = function() {
		this.widget.stop();
	}

	AudioFilePlayer.prototype.setVolume = function(vol) {
		if (this.widget && this.widget.setVolume && this.soundOptions)
			/*this.widget*/soundManager.setVolume(this.soundOptions.id, 100 * vol);
	}

	return AudioFilePlayer;
})();

SoundCloudPlayer = (function() {
	var EVENT_MAP = {
		"onplay": "onPlaying",
		"onresume": "onPlaying",
		"onpause": "onPaused",
		"onstop": "onPaused",
		"onfinish": "onEnded"
	};

	function SoundCloudPlayer(eventHandlers, embedVars) {  
		this.label = 'SoundCloud';
		this.eventHandlers = eventHandlers || {};
		this.embedVars = embedVars || {};
		this.element = null;
		this.widget = null;
		this.isReady = false;
		this.trackInfo = {};
		this.soundOptions = {};

		var that = this;
		$.getScript("https://connect.soundcloud.com/sdk.js", function() {
			SC.initialize({client_id: "9d5bbaf9df494a4c23475d9fde1f69b4"});
			for (var i in EVENT_MAP)
				(function(i) {
					that.soundOptions[i] = function() {
						console.log("event:", i, this);
						var handler = eventHandlers[EVENT_MAP[i]];
						handler && handler(that);
					}
				})(i);
			/*that.soundOptions.onerror =*/ that.soundOptions.ontimeout = function(e) {
				console.log("SoundCloudPlayer timeout/error event:", e);
				if (that.eventHandlers.onError)
					that.eventHandlers.onError(that);
			}
			that.isReady = true;
			that.callHandler("onApiLoaded", that); // eventHandlers.onApiLoaded && eventHandlers.onApiLoaded(that);
			that.callHandler("onApiReady", that); // eventHandlers.onApiReady && eventHandlers.onApiReady(that);
		});

		this.callHandler = function(name, params) {
			try {
				eventHandlers[name] && eventHandlers[name](params);//.apply(null, params);
			}
			catch (e) {
				console.log(e, e.stack);
			}
		}
	}

	SoundCloudPlayer.prototype.safeCall = function(fctName, param) {
		try {
			console.log("safecall", fctName);
			this.widget[fctName](param);
		}
		catch(e) {
			console.log("safecall error", e, e.stack);
		}
	}

	SoundCloudPlayer.prototype.getEid = function(url, cb) {
		var matches = /https?:\/\/(?:www\.)?soundcloud\.com\/([\w-_\/]+)/.exec(url);
		cb(matches ? url.substr(url.lastIndexOf("/")+1) : null, this);
	}

	SoundCloudPlayer.prototype.getTrackInfo = function(callback) {
		var that = this;
		var i = setInterval(function() {
			console.log("info", that.widget.duration)
			if (that.widget && that.widget.duration) {
				clearInterval(i);
				callback(that.widget);
			}
		}, 500);
	}

	SoundCloudPlayer.prototype.getTrackPosition = function(callback) {
		callback(this.trackInfo.position = this.widget.position / 1000);
		if (this.widget.durationEstimate)
			this.eventHandlers.onTrackInfo && this.eventHandlers.onTrackInfo({
				duration: this.widget.duration / 1000
			});
	};
	
	SoundCloudPlayer.prototype.setTrackPosition = function(pos) {
		this.safeCall("setPosition", pos * 1000);
	};

	SoundCloudPlayer.prototype.play = function(id) {
		this.trackInfo = {};
		this.embedVars.trackId = id;
		console.log("soundcloud play", this.embedVars);
		var that = this;

		var loadTimeout = setTimeout(function() {
			if (!that.trackInfo.position)
				that.callHandler("onError", "timeout");
		}, 8000);

		SC.stream("/tracks/"+id, this.soundOptions, function(sound){
			that.widget = sound;
			that.callHandler("onEmbedReady", that);
			//that.safeCall("getCurrentSound");
			that.safeCall("play");
			//sound.play();
		});
	}

	SoundCloudPlayer.prototype.resume = function() {
		this.safeCall("play");
	}

	SoundCloudPlayer.prototype.pause = function() {
		this.safeCall("pause");
	}

	SoundCloudPlayer.prototype.stop = function() {
		this.safeCall("stop");
	}

	SoundCloudPlayer.prototype.setVolume = function(vol) {
		this.safeCall("setVolume", 100 * vol);
	}

	return SoundCloudPlayer;
})();

/*
SoundCloudPlayer = (function() {

	var PLAYER_PREFIX = / *window.location.protocol+* /'https://w.soundcloud.com/player/'; // forcing https to prevent auto-download of soundcloud's player (is this a sc bug?!)
	var API_PREFIX = window.location.protocol+'//api.soundcloud.com/tracks/';
	var EVENT_MAP = {
		"play": "onPlaying",
		"pause": "onPaused",
		"finish": "onEnded"
	};

	function SoundCloudPlayer(eventHandlers, embedVars) {  
		this.label = 'SoundCloud';
		//this.eventHandlers = eventHandlers || {};
		this.embedVars = embedVars || {};
		this.element = null;
		this.widget = null;
		this.isReady = false;
		this.trackInfo = {};
		var that = this;
		var apiLoader = setInterval(function() {
			try {
				that.isReady = true;
				that.callHandler("onApiLoaded", that); // eventHandlers.onApiLoaded && eventHandlers.onApiLoaded(that);
				that.callHandler("onApiReady", that); // eventHandlers.onApiReady && eventHandlers.onApiReady(that);
				clearInterval(apiLoader);
			}
			catch(e) {
				console.log("soundcloud error", e, e.stack);
			}
		}, 200);
		this.callHandler = function(name, params) {
			try {
				eventHandlers[name] && eventHandlers[name](params);//.apply(null, params);
			}
			catch (e) {
				console.log(e, e.stack);
			}
		}
	}

	SoundCloudPlayer.prototype.embed = function(vars) {
		//console.log("soundcloud embed", vars)
		this.embedVars = vars = vars || {};
		this.element = document.createElement('iframe');
		this.element.id = vars.playerId = vars.playerId || 'soundcloudPlayer' ;//+ (new Date()).getTime();
		this.element.width = 320;
		this.element.height = 60;
		this.element.src = PLAYER_PREFIX + '?url=' + API_PREFIX + (vars.trackId || '') + '&auto_play=' + (vars.autoplay ? 'true' : 'false');
		this.holder = document.createElement("div");
		this.holder.id = "genericholder";
		this.holder.appendChild(this.element);
		this.embedVars.playerContainer.appendChild(this.holder);
		this.trackInfo = {};
		var that = this;

		var isEmbedReady = false;
		var loadTimeout = setTimeout(function() {
			if (!isEmbedReady)
				that.callHandler("onError"/ *, that* /);
		}, 4000);

		messageHandlers["soundcloud"] = function(data, e) {
			//console.log("SOUNDCLOUD EVENT", data.method / *, data.value, data* /);
			if (data.method == "ready") {
				isEmbedReady = true;
				if (loadTimeout)
					clearTimeout(loadTimeout);
				that.callHandler("onEmbedReady", that); // that.eventHandlers.onEmbedReady && that.eventHandlers.onEmbedReady(that);
				that.safeCall("getCurrentSound");
			}
			else if (data.method == "getCurrentSound") {
				that.callHandler("onTrackInfo", that.trackInfo = { // that.eventHandlers.onTrackInfo && that.eventHandlers.onTrackInfo(that.trackInfo = {
					duration: data.value.duration / 1000
				});				
				setTimeout(function() { that.resume(); }, 2000); // just in case
			}
			else if (data.method == "getPosition") {
				that.trackInfo.position = data.value / 1000;
				that.positionCallback(that.trackInfo.position);
				if (that.trackInfo.duration - that.trackInfo.position < 1)
					that.callHandler("onEnded", that); // that.eventHandlers["onEnded"](that);
			}
			else
				that.callHandler(EVENT_MAP[data.method], that); // that.eventHandlers[i](that);
		};
	}

	SoundCloudPlayer.prototype.safeCall = function(fctName, param) {
		try {
			//console.log("safecall", fctName/ *, param* /);
			this.element.contentWindow.postMessage(JSON.stringify({method:fctName, value:param}), this.element.src.split("?")[0]);
		}
		catch(e) {
			console.log("safecall error", e, e.stack);
		}
	}

	SoundCloudPlayer.prototype.getEid = function(url, cb) {
		var matches = /https?:\/\/(?:www\.)?soundcloud\.com\/([\w-_\/]+)/.exec(url);
		cb(matches ? / *matches.pop()* / url.substr(url.lastIndexOf("/")+1) : null, this);
	}

	SoundCloudPlayer.prototype.getTrackPosition = function(callback) {
		//console.log("SC getTrackPos...");
		this.positionCallback = callback;
		this.safeCall("getPosition");
	};
	
	SoundCloudPlayer.prototype.setTrackPosition = function(pos) {
		this.safeCall("seekTo", pos * 1000);
	};

	SoundCloudPlayer.prototype.play = function(id) {
		this.embedVars.trackId = id;
		this.embedVars.autoplay = true;
		this.trackInfo = {};
		this.embed(this.embedVars);
	}

	SoundCloudPlayer.prototype.resume = function() {
		this.safeCall("play");
		var that = this;
		setTimeout(function() { that.callHandler("onPlaying", that); }, 200);
	}

	SoundCloudPlayer.prototype.pause = function() {
		this.safeCall("pause");
	}

	SoundCloudPlayer.prototype.stop = function() {}

	SoundCloudPlayer.prototype.setVolume = function(vol) {
		this.safeCall("setVolume", 100 * vol);
	}

	return SoundCloudPlayer;
})();
*/

YoutubePlayer = (function() {
	//includeJS("https://www.youtube.com/player_api", eventHandlers.onApiLoaded);
	var EVENT_MAP = {
		/*YT.PlayerState.ENDED*/ 0: "onEnded",
		/*YT.PlayerState.PLAYING*/ 1: "onPlaying",
		/*YT.PlayerState.PAUSED*/ 2: "onPaused"
	};

	function YoutubePlayer(eventHandlers, embedVars) {
		this.eventHandlers = eventHandlers || {};
		this.embedVars = embedVars || {};
		this.label = "Youtube";
		this.isReady = false;
		this.trackInfo = {};
		var that = this;

		window.onYoutubeStateChange = function(newState) {
			//console.log(that.embedVars.playerId + " state:", newState);
			if (newState == 1)
				that.trackInfo.duration = that.element.getDuration();
			var eventName = EVENT_MAP[newState];
			if (eventName && that.eventHandlers[eventName])
				that.eventHandlers[eventName](that);
		};

		window.onYoutubeError = function(error) {
			console.log(that.embedVars.playerId + " error:", error);
			if (eventHandlers.onError)
				eventHandlers.onError(that);
		}

		window.onYouTubePlayerReady = window.onYouTubePlayerAPIReady = function(playerId) {
			that.element = /*that.element ||*/ document.getElementById(playerId); /* ytplayer*/
			that.element.addEventListener("onStateChange", "onYoutubeStateChange");
			that.element.addEventListener("onError", "onYoutubeError");
		}

		that.isReady = true;
		if (that.eventHandlers.onApiLoaded)
			that.eventHandlers.onApiLoaded(that);
		if (that.eventHandlers.onApiReady)
			setTimeout(function() { that.eventHandlers.onApiReady(that); }, 500);
	}

	YoutubePlayer.prototype.safeCall = function(fctName, param) {
		try {
			this.element[fctName](param);
		}
		catch(e) {
			console.log("safecall error", e, e.stack);
		}
	}

	YoutubePlayer.prototype.safeClientCall = function(fctName, param) {
		try {
			if (this.eventHandlers[fctName])
				this.eventHandlers[fctName](param);
		}
		catch(e) {
			console.log("safeclientcall error", e, e.stack);
		}
	}

	YoutubePlayer.prototype.embed = function (vars) {
		//console.log("youtube embed:", vars);
		this.embedVars = vars = vars || {};
		this.embedVars.playerId = this.embedVars.playerId || 'ytplayer';
		this.trackInfo = {};
		this.element = document.createElement("object");
		this.element.id = this.embedVars.playerId;

		//this.embedVars.playerContainer.appendChild(this.element);
		this.holder = document.createElement("div");
		this.holder.id = "genericholder";
		this.holder.appendChild(this.element);
		this.embedVars.playerContainer.appendChild(this.holder);

		var embedAttrs = {
			id: this.embedVars.playerId,
			width: this.embedVars.height || '200',
			height: this.embedVars.width || '200',
			type: "application/x-shockwave-flash",
			//data: 'https://www.youtube.com/apiplayer?autoplay=1&amp;version=3&amp;enablejsapi=1&amp;playerapiid='+vars.playerId+'&amp;controls=0&amp;modestbranding=1&amp;showinfo=0&amp;wmode=transparent&amp;origin=' + vars.origin,
			data: window.location.protocol+'//www.youtube.com/v/'+this.embedVars.videoId+'?autoplay=1&amp;version=3&amp;enablejsapi=1&amp;playerapiid='+this.embedVars.playerId+'&amp;controls=0&amp;modestbranding=1&amp;showinfo=0&amp;wmode=opaque&amp;iv_load_policy=3&amp;origin=' + this.embedVars.origin,
			innerHTML: '<param value="always" name="allowScriptAccess"><param value="opaque" name="wmode">'
		};
		if (USE_SWFOBJECT) {
        	//swfobject.addDomLoadEvent(function(){console.log("swfobject is ready")});
			var params = {
				autoplay: 1,
				version: 3, 
				enablejsapi: 1,
				playerapiid: this.embedVars.playerId,
				controls: 0,
				modestbranding: 1,
				showinfo: 0,
				wmode: "opaque",
				origin: this.embedVars.origin,
				//allowFullScreen: "true",
				allowscriptaccess: "always",
				iv_load_policy: 3 // remove annotations
			};
			swfobject.embedSWF(embedAttrs.data, this.embedVars.playerId, embedAttrs.width, embedAttrs.height, "9.0.0", "/js/swfobject_expressInstall.swf", null, params);
		}
		else {
			$(this.element).attr(embedAttrs);
		}
		$(this.element).show();
		/*!this.isReady &&*/ this.safeClientCall("onEmbedReady");
		//this.isReady = true;
	}

	YoutubePlayer.prototype.getEid = function(url, cb) {
		var regex = // /https?\:\/\/(?:www\.)?youtu(?:\.)?be(?:\.com)?\/(?:(?:.*)?[\?\&]v=|v\/|embed\/|\/)?([a-zA-Z0-9_\-]+)/; //^https?\:\/\/(?:www\.)?youtube\.com\/[a-z]+\/([a-zA-Z0-9\-_]+)/
			/(youtube\.com\/(v\/|embed\/|(?:.*)?[\?\&]v=)|youtu\.be\/)([a-zA-Z0-9_\-]+)/;
		//var matches = regex.exec(url);
		var matches = url.match(regex);
		cb(matches ? matches.pop() : null, this);
	}

	YoutubePlayer.prototype.play = function(id) {
		//console.log("PLAY -> YoutubePlayer", this.currentId, id);
		if (!this.currentId || this.currentId != id) {
			this.embedVars.videoId = id;
			this.embed(this.embedVars);
		}
	}

	YoutubePlayer.prototype.pause = function() {
		//console.log("PAUSE -> YoutubePlayer"/*, this.element, this.element && this.element.pauseVideo*/);
		if (this.element && this.element.pauseVideo)
			this.element.pauseVideo();
	}

	YoutubePlayer.prototype.resume = function() {
		//console.log("RESUME -> YoutubePlayer", this.element, this.element && this.element.playVideo);
		if (this.element && this.element.playVideo)
			this.element.playVideo();
	}
	
	YoutubePlayer.prototype.stop = function() {
		if (this.element && this.element.stopVideo)
			this.element.stopVideo();
		//$(this.element).remove();//.hide();
	}
	
	YoutubePlayer.prototype.getTrackPosition = function(callback) {
		if (callback && this.element && this.element.getCurrentTime)
			callback(this.element.getCurrentTime());
	};
	
	YoutubePlayer.prototype.setTrackPosition = function(pos) {
		if (this.element && this.element.seekTo)
			this.element.seekTo(pos, true);
	};
	
	YoutubePlayer.prototype.setVolume = function(vol) {
		if (this.element && this.element.setVolume)
			this.element.setVolume(vol * 100);
	};

	return YoutubePlayer;
})();

/////////////////////////////////////////////////////////////////////////////////

function Playem(playerFunctions) {

	var players = []; // instanciated Player classes, added by client
	playerFunctions = playerFunctions || {}; // provided handlers for players' events

	playerFunctions.onError = playerFunctions.onError || function(error) {
		alert(error);
	};

	// core functions
	
	var currentTrack = null;
	var trackList = [];
	var whenReady = null;
	var playersToLoad = 0;
	var progress = null;
	var that = this;

	function doWhenReady(player, fct) {
		//console.log("do when ready", player.label, player.isReady);
		var done = false;
		whenReady = {
			player: player,
			fct: function () {
				if (done) return;
				done = true;
				fct();
				whenReady = null;
			}
		};
		if (player.isReady)
			whenReady.fct();
	}

	function addTrackById(id, player, metadata) {
		if (id) {
			var track = {
				index: trackList.length,
				trackId: id,
				//img: img,
				player: player,
				playerName: player.label.replace(/ /g, "_"),
				metadata: metadata || {}
			};
			trackList.push(track);
			//console.log("added:", player.label, "track", id, track/*, metadata*/);
		}
		else
			console.log("warning: no id provided");
	}

	var volume = 1;

	function setVolume(vol) {
		volume = vol;
		if (currentTrack && currentTrack.player.setVolume)
			currentTrack.player.setVolume(vol);
	}

	function playTrack(track) {
		console.log("playTrack", track);
		doWhenReady(track.player, function() {
			if (currentTrack) {
				currentTrack.player.stop && currentTrack.player.stop();
				$("#genericholder iframe").attr("src", ""); // to make sure that IE really destroys the iframe embed
				$("#genericholder").html("").remove();
				if (progress)
					clearInterval(progress);
			}
			currentTrack = track;
			delete currentTrack.trackPosition; // = null;
			delete currentTrack.trackDuration; // = null;
			if (playerFunctions.onTrackChange)
				playerFunctions.onTrackChange(track);
			//console.log("playing", track);
			track.player.play(track.trackId);
			setVolume(volume);
			if (currentTrack.index == trackList.length-1 && playerFunctions.loadMore)
				playerFunctions.loadMore();
		});
	}

	// functions that are called by players => to propagate to client
	function createEventHandlers (playemFunctions) {
		var eventHandlers = {
			onApiReady: function(player){
				//console.log(player.label + " api ready");
				if (whenReady && player == whenReady.player)
					whenReady.fct();
				if (playerFunctions.onReady && 0 == --playersToLoad)
					playerFunctions.onReady();
			},
			onEmbedReady: function(player) {
				console.log("embed ready");
				setVolume(volume);
			},
			onPlaying: function(player) {
				//console.log(player.label + ".onPlaying");
				setVolume(volume);
				playerFunctions.onPlay && setTimeout(function() {
					playerFunctions.onPlay();
				}, 1);
				if (/*playerFunctions.onTrackInfo &&*/ player.trackInfo && player.trackInfo.duration)
					this.onTrackInfo({
						position: player.trackInfo.position || 0,
						duration: player.trackInfo.duration
					});

				if (progress)
					clearInterval(progress);
				if (player.getTrackPosition && playerFunctions.onTrackInfo) {
					var that = eventHandlers; //this;
					progress = setInterval(function(){
						player.getTrackPosition(function(trackPos) {
							that.onTrackInfo({
								position: trackPos,
								duration: player.trackInfo.duration || currentTrack.trackDuration
							});
						});
					}, 1000);
				}
			},
			onTrackInfo: function(trackInfo) {
				//console.log("ontrackinfo", trackInfo, currentTrack);
				if (currentTrack && trackInfo) {
					if (trackInfo.duration)
						currentTrack.trackDuration = trackInfo.duration;
					if (trackInfo.position)
						currentTrack.trackPosition = trackInfo.position;
				}
				playerFunctions.onTrackInfo && playerFunctions.onTrackInfo(currentTrack);
			},
			onPaused: function(player) {
				//console.log(player.label + ".onPaused");
				if (progress)
					clearInterval(progress);
				progress = null;
				//if (!avoidPauseEventPropagation)
				//	playerFunctions.onPause();
				//avoidPauseEventPropagation = false;
			},
			onEnded: function(player) {
				//console.log(player.label + ".onEnded");
				playerFunctions.onEnd && playerFunctions.onEnd();
				playemFunctions.next();
			},
			onError: function(player) {
				//console.log(player.label + ".error");
				setTimeout(function() {
					playemFunctions.next();
				}, 1000);
			}
		};
		return eventHandlers;
	}

	// exported methods, mostly wrappers to Players' methods
	return {
		addPlayer: function (playerClass, vars) {
			playersToLoad++;
			players.push(new playerClass(createEventHandlers(this), vars));
		},
		getQueue: function() {
			return trackList;
		},
		clearQueue: function() {
			trackList = [];
		},
		addTrackByUrl: function(url, metadata) {
			var remaining = players.length;
			for (var p=0; p<players.length; ++p)
				players[p].getEid(url, function(eid, player){
					//console.log("test ", player.label, eid);
					if (eid)
						addTrackById(eid, player, metadata);
					else if (--remaining == 0) {
						$(metadata.post).addClass("disabled");
						console.log("unrecognized track:", url, metadata);
					}
				});
		},
		play: function(i) {
			playTrack(i != undefined ? trackList[i] : currentTrack || trackList[0]);
		},
		pause: function() {
			currentTrack.player.pause();
			playerFunctions.onPause();
		},
		resume: function() {
			currentTrack.player.resume();
		},
		next: function() {
			// playTrack(trackList[(currentTrack.index + 1) % trackList.length]);
      console.log(trackList.length);
      randomNext = Math.floor(Math.random() * trackList.length) + 1;
			playTrack(trackList[(currentTrack.index + randomNext) % trackList.length]);
      console.log('next TRACK !');
		},
		prev: function() {
			playTrack(trackList[(trackList.length + currentTrack.index - 1) % trackList.length]);
		},
		seekTo: function(pos) {
			if (currentTrack && currentTrack.trackDuration)
				currentTrack.player.setTrackPosition(pos * currentTrack.trackDuration);
		},
		setVolume: setVolume
	};
}

/////////////////////////////////////////////////////////////////////////////////

function ProgressBar(p) {
	var p = p || {};
	var updateBarOnDrag = p.updateBarOnDrag;
	this.value = p.value || 0;
	var $progressTrack = p.progressTrack;
	var $progressBar = $progressTrack.find(".progressBar");
	var $progressCursor = $progressTrack.find(".progressCursor");
	var draggingCursor = false;
	$progressTrack.mousedown(function(e) {
		//console.log("progresstrack.mousedown", e, $progressTrack);
		var start_x = e.pageX;
		var min_x = $progressTrack.offset().left + 3;
		var width = $progressTrack.width();
		var offset_x = Math.min(width, Math.max(0, e.pageX - min_x));
		draggingCursor = true;
		function moveCursor(e) {
			offset_x = Math.min(width, Math.max(0, e.pageX - min_x));
			$progressCursor.css("left", offset_x -6 + "px");
			if (updateBarOnDrag)
				$progressBar.css("width", 100 * (offset_x / width) + "%");
		}
		$(document).mousemove(moveCursor).one('mouseup', function(e) {
			draggingCursor = false;
			$(document).unbind('mousemove');
			moveCursor(e);
			p.onChange(this.value = offset_x / width);
		});
		return false;
	});
	this.setValue = function(newValue) {
		if (NaN != newValue && !draggingCursor) {
			this.value = Math.min(1, Math.max(0, newValue));
			$progressBar.css("width", 100 * this.value + "%");
			$progressCursor.css("left", $progressTrack.width() * this.value - 6 + "px");
		}
		return this.value;
	}
}

/////////////////////////////////////////////////////////////////////////////////

function WhydPlayer () {

	var currentTrack = null;
	var isPlaying = false;

	// utility functions

	function setPageTitlePrefix(symbol) {
		var spacePos = window.document.title.indexOf(" ");
		if (spacePos < 3)
			window.document.title = window.document.title.substr(spacePos+1);
		window.document.title = symbol + " " + window.document.title;
	}

	// ui init

	var div = document.getElementById("whydPlayer");
	if (!div) {
		document.body.appendChild(document.createElement('div')).id = "whydPlayer";
		div = document.getElementById("whydPlayer");
		//div.appendChild(document.createElement('div')).id = "playerContainer";
		div.appendChild(document.createElement('div')).innerHTML = [
			'<div class="buttons">',
			'	<button id="btnPrev" onclick="playem.prev()"></button>',
			'	<button id="btnPlay" onclick="playem.playPause()"></button>',
			'	<button id="btnNext" onclick="playem.next()"></button>',
			'</div>',
		//	'<span id="trackPoster">(none)</span>',
			'<div class="progressPanel">',
			'	<div id="btnLike" class="button" onclick="playem.like()"><div></div></div>',
			'	<div id="btnRepost" class="button" onclick="playem.repost()"><div></div></div>',
			'	<span id="trackTitle">(none)</span>',
			'	<div id="progressTrack" class="progressTrack">',
			'		<div id="progressBar" class="progressBar"></div>',
			'		<div id="progressCursor" class="progressCursor"></div>',
			'	</div>',
			'	<div id="progressTimer"></div>',
			'</div>',
			'<div class="volumePanel">',
			'	<div class="volume less"></div>',
			'	<div id="volumeTrack" class="progressTrack">',
			'		<div class="progressBar"></div>',
			'		<div class="progressCursor"></div>',
			'	</div>',
			'	<div class="volume more"></div>',
			'</div>'
		].join('\n');
	}

	var $body = $("body");
	var $trackTitle = $("#trackTitle");
	var $trackNumber = $("#trackNumber");
	var $trackSrc = $("#trackSrc");

	function setState (state, $post) {
		var loading = (state == "loading");
		isPlaying = (state == "playing");

		$body.toggleClass("playing", isPlaying);
		$trackTitle.toggleClass("loading", loading);

		var classes = $body.attr("class").split(" ");
		for (var i in classes)
			if (classes[i].indexOf("playing_") == 0)
				$body.removeClass(classes[i]);
		$body.addClass("playing_" + currentTrack.playerName);

		$trackSrc.attr("href", currentTrack.metadata.url);

		// for invisible embeds (e.g. soundcloud)
		$(".post .play").removeClass("loading").removeClass("playing").removeClass("paused");
		if ($post)
			$post.find(".play").addClass(state);

		// for visible embeds (e.g. youtube)
		$("#playBtnOverlay").removeClass("loading").removeClass("playing").removeClass("paused").addClass(state);
	}

	var $progressTimer = $("#progressTimer");
	
	var progressBar = new ProgressBar({
		progressTrack: $("#progressTrack"),
		onChange: function(pos) {
			playem.seekTo(pos);
			setProgress(pos);
		}
	});

	function setProgress(progress) {
		if (progress && NaN != progress && currentTrack.trackDuration) {
			progressBar.setValue(progress);
			var sec = currentTrack.trackDuration - (currentTrack.trackDuration * progress);
			var mn = Math.floor(sec / 60);
			sec = ""+Math.floor(sec - (mn * 60));
			$progressTimer.text("-" + mn + ":" + (sec.length < 2 ? "0" : "") + sec);
		}
	}

	var $volumeTrack = $("#volumeTrack");
	if ($volumeTrack.length)
		var volumeBar = new ProgressBar({
			value: 1.0,
			updateBarOnDrag: true,
			progressTrack: $volumeTrack,
			onChange: function(pos) {
				playem.setVolume(pos);
				volumeBar.setValue(pos);
			}
		});

	$(".volume.less").click(function(){
		playem.setVolume(volumeBar.setValue(/*volumeBar.value - 0.1*/ 0));
	});
	$(".volume.more").click(function(){
		playem.setVolume(volumeBar.setValue(/*volumeBar.value + 0.1*/ 1));
	});

	// data provider

	var shortcuts = {
		"/yt/": window.location.protocol+"//youtube.com/v/",
		"/sc/": window.location.protocol+"//soundcloud.com/",
		"/vi/": window.location.protocol+"//vimeo.com/"
	};

	function addTrackFromAnchor(e, trackHandler) {
		var src = e.dataset ? e.dataset.eid : e.getAttribute("data-eid");
		if (src) {
			src = ""+src;
			for (var s in shortcuts)
				if (src.indexOf(s) == 0) {
					src = src.replace(s, shortcuts[s]);
					break;
				}
			var post = e.parentNode;
			var title = (post.getElementsByTagName("h2") || [])[0];
			var authorHtml = ($(post).find(".author")/*post.getElementsByClassName("author")*/ || [])[0];
			var metadata = {
				title: title ? title.innerHTML : null,
				url: e.getAttribute("href"),
				authorHtml: authorHtml ? authorHtml.innerHTML/*textContent*/ : null,
				post: post,
				img: $(post).find(".thumb > img").first().attr("src"),
				pid: $(post).attr("data-pid"),
				isLoved: !!(post.dataset ? post.dataset.loved : post.getAttribute("data-loved"))
			};
			playem.addTrackByUrl(src, metadata);
		}
	}

	function populateTracksFromPosts(posts) {
		//console.log("updating track list...");
		playem.clearQueue();
		var posts = $(".post:visible");
		for (var i=0; i<posts.length; ++i)
			addTrackFromAnchor(posts[i].getElementsByTagName("a")[0]);
		return playem.getQueue();
	}

	var $post = null;

	function repositionPlayer(/*$post*/) {
		//var $post = $post || $(".post:visible[data-pid="+track.metadata.pid+"]").addClass("playing");

		// show and move the player to the current post
		var postPos = $post.offset();
		if (postPos) {
			var $feed = $post.parent();
			var feedPos = $feed.offset();
			playerContainer.parentNode.style.left =
				parseInt($feed.css("padding-left"))
				+ parseInt($post.css("padding-left"))
				+ feedPos.left + "px";
			playerContainer.parentNode.style.top =
				//parseInt($feed.css("padding-top"))
				parseInt($post.css("padding-top"))
				//+ parseInt($post.css("margin-top"))
				+ postPos.top
				- $(document).scrollTop() + "px"; // - $("#header").height() + "px";
			//console.log("sum", playerContainer.parentNode.style.top);
		}
	}

	function highlightTrack(track) {
		console.log("highlight track", track);
		$(".post").removeClass("playing");
		/*var */$post = $(".post:visible[data-pid="+track.metadata.pid+"]").addClass("playing");

		// only show the floating player when there is a video embed to show (e.g. youtube)
		//if (track.player.element && track.player.element.parentNode == playerContainer)
			$(playerContainer.parentNode).toggleClass("reduced", $post.length == 0 || $post.is(':hidden'));

		repositionPlayer(/*$post*/);

		return $post;
	}

	// playem interface

	var whydPlayerFunctions = {
		onReady: function() {
			// hide the player after init
			//$(playerContainer.parentNode).addClass("reduced");
			//populateTracksFromPosts();
		},
		onTrackChange: function(track) {
			currentTrack = track;
			currentTrack.yetToPublish = true;
			//console.log("on track change", currentTrack);

			// display the play bar and the player
			$(div).show();
			$("#contentPane").addClass("withPlayer");
			setProgress();

			// update the current track title
			$trackTitle.html(track.metadata.title);
			$trackNumber.text((track.index + 1) + ". ");
			try { $trackTitle.ajaxify(); } catch(e) {}
			$("#trackThumb").css("background-image", "url('" + track.metadata.img + "')");
			//$("#trackPoster").html(track.metadata.authorHtml);
			$("#btnLike").toggleClass("loved", track.metadata.isLoved);
			
			// highlight the post being played
			$post = highlightTrack(track);
			setState("loading", $post);
		},
		onPlay: function() {
			//var $post = $(".post:visible[data-pid="+currentTrack.metadata.pid+"]")
			setState("playing", $post);
			setPageTitlePrefix("▶");
			$("#btnPlay").addClass("playing");

			if (currentTrack.yetToPublish) {
				currentTrack.yetToPublish = false;
				// ajax increment play counter
				$.post("/api/post", {action:"incrPlayCounter", pId:currentTrack.metadata.pid}, function() {
					var $nbPlays = $post.find(".nbPlays");
					$nbPlays.text((parseInt($nbPlays.text()) || 0) + 1).show();
				});
				//fbAction("listen", "/c/" + currentTrack.metadata.pid, "track");
				currentTrack.metadata.tStart = new Date();
			}
		},
		onEnd: function() {
			if (window.user && window.user.lastFm)
				$.post("/api/post", {
					action: "scrobble",
					pId: currentTrack.metadata.pid,
					trackDuration: currentTrack.trackDuration,
					timestamp: Math.floor(currentTrack.metadata.tStart.getTime() / 1000)
				}, function(res) {
					console.log("scrobbled to last.fm, baby!", res);
				});				
		},
		onPause: function() {
			//var $post = $(".post:visible[data-pid="+currentTrack.metadata.pid+"]")
			setState("paused", $post);
			setPageTitlePrefix("❚❚");
			$("#btnPlay").removeClass("playing");
		},
		loadMore: function() {
			var $btnLoadMore = $(".btnLoadMore:visible");
			if ($btnLoadMore.length)
				$btnLoadMore.click();
		},
		onTrackInfo: function(info) {
			var progress = Number(info.trackPosition) / Number(info.trackDuration);
			//console.log("FINAL onTrackInfo", info.trackPosition, "/", info.trackDuration, progress);
			setProgress(progress);
		}
	};

	// init playem DOM elements

	var playerContainer = document.createElement('div');
	$(playerContainer).append('<div id="playBtnOverlay" onclick="window.playem.playPause();">');

	var $containerParent = $("#contentPane");
	if (!$containerParent.length)
		$containerParent = $("body");

	$containerParent.prepend($('<div id="playerContainer" class="reduced">').append(playerContainer));

	// init playem object, based on DOM elements

	var playem = new Playem(whydPlayerFunctions);

	playem.addPlayer(YoutubePlayer, {
		playerId: "genericplayer",
		origin: window.location.host || window.location.hostname || "whyd.com",
		playerContainer: playerContainer
	});

	playem.addPlayer(SoundCloudPlayer, {
		playerId: "genericplayer",
		playerContainer: ($('<div id="containerSoundCloud">').appendTo("body"))[0]
	});

	playem.addPlayer(VimeoPlayer, {
		playerId: "genericplayer",
		playerContainer: playerContainer
	});

	playem.addPlayer(AudioFilePlayer);

	// ui-bound handlers

	var exports = {
		getCurrentTrack: function() {
			return currentTrack;
		},
		pause: function() {
			if (currentTrack && isPlaying)
				playem.pause();
		},
		playPause: function() {
			if (!currentTrack)
				this.playAll();
			else if (isPlaying)
				playem.pause();
			else
				playem.resume();
		},
		next: function() {
			playem.next();
		},
		prev: function() {
			playem.prev();
		},
		playAll: function(postNode) {
			var trackList = populateTracksFromPosts();
			var trackNumber = 0;
			if (postNode)
				for (var i in trackList)
					if (trackList[i].metadata.post == postNode)
						trackNumber = i;
			if (currentTrack && currentTrack.metadata.post == postNode)
				this.playPause();
			else
				playem.play(trackNumber);
		},
		updateTracks: function() {
			populateTracksFromPosts();
		},
		like: function() {
			if (currentTrack.metadata)
				toggleLovePost(currentTrack.metadata.post.dataset.pid);
		},
		repost: function() {
			if (currentTrack.metadata)
				publishPost(currentTrack.metadata.post.dataset.pid);
		},
		refresh: function() {
			if (currentTrack) {
				/*var $post =*/ highlightTrack(currentTrack);
				setState(isPlaying ? "playing" : "loading", $post);
			}
		},
		repositionPlayer: function() {
			if (currentTrack)
				repositionPlayer();
		},
		populateTracks: function() {
			populateTracksFromPosts();
			this.refresh();
		},
		setVolume: function(vol) {
			playem.setVolume(vol);
		}
	};

	populateTracksFromPosts();
	return exports;
}

loader.whenReady(function() {
	//console.log("Loading playem...");
	window.playem = new WhydPlayer();
	window.playTrack = function (embedLink) {
		window.playem.playAll(embedLink.parentNode);
	}
	if (window.location.href.indexOf("#autoplay") != -1)
		window.playem.playAll();

	// i'm embarrassed, please don't read this!
	setInterval(window.playem.repositionPlayer, 1000);
	$(window).resize(window.playem.repositionPlayer);
	$(window).scroll(window.playem.repositionPlayer);
	//console.log("Playem is ready!");
});
window.playem.playAll();
console.log('play all');