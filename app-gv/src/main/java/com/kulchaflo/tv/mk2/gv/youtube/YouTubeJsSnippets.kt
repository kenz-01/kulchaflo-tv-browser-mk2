package com.kulchaflo.tv.mk2.gv.youtube

import org.json.JSONObject

object YouTubeJsSnippets {
    fun buildQualityHelperProbeScript(
        promptPrefix: String,
        reason: String,
        attempt: Int,
    ): String {
        val escapedPromptPrefix = JSONObject.quote(promptPrefix)
        val escapedReason = JSONObject.quote(reason)
        return """
            javascript:(function(){
              try{
                var promptPrefix=${escapedPromptPrefix};
                var checkReason=${escapedReason};
                var attempt=${attempt};
                var pageUrl=(window.location&&window.location.href)||'';
                var lower=function(v){return String(v||'').toLowerCase();};
                var toNum=function(v){var n=Number(v);return Number.isFinite(n)?n:0;};
                var firstVideo=function(){
                  try{
                    return document.querySelector('#movie_player video, video');
                  }catch(_){return null;}
                };
                var moviePlayer=function(){
                  try{
                    return document.querySelector('#movie_player') || (window.movie_player||null);
                  }catch(_){return null;}
                };
                var player=moviePlayer();
                var hasPlayer=!!player;
                var hasGetLevels=!!(player&&typeof player.getAvailableQualityLevels==='function');
                var hasGetCurrent=!!(player&&typeof player.getPlaybackQuality==='function');
                var hasSetRange=!!(player&&typeof player.setPlaybackQualityRange==='function');
                var hasSetQuality=!!(player&&typeof player.setPlaybackQuality==='function');
                var levels=[];
                var currentBefore='';
                try{ if(hasGetLevels){ levels=(player.getAvailableQualityLevels()||[]).map(function(v){return String(v||'');}); } }catch(_){}
                try{ if(hasGetCurrent){ currentBefore=String(player.getPlaybackQuality()||''); } }catch(_){}
                var videoBefore=firstVideo();
                var widthBefore=toNum(videoBefore&&videoBefore.videoWidth);
                var heightBefore=toNum(videoBefore&&videoBefore.videoHeight);
                var target='';
                if(levels.indexOf('hd1080')>=0){target='hd1080';}
                else if(levels.indexOf('hd720')>=0){target='hd720';}
                var methodsApplied=[];
                if(target){
                  try{ if(hasSetRange){ player.setPlaybackQualityRange(target); methodsApplied.push('setPlaybackQualityRange'); } }catch(_){}
                  try{ if(hasSetQuality){ player.setPlaybackQuality(target); methodsApplied.push('setPlaybackQuality'); } }catch(_){}
                }
                setTimeout(function(){
                  try{
                    var currentAfter='';
                    try{ if(hasGetCurrent){ currentAfter=String(player.getPlaybackQuality()||''); } }catch(_){}
                    var videoAfter=firstVideo();
                    var widthAfter=toNum(videoAfter&&videoAfter.videoWidth);
                    var heightAfter=toNum(videoAfter&&videoAfter.videoHeight);
                    window.prompt(promptPrefix+JSON.stringify({
                      type:'youtube-quality-helper',
                      action:'report',
                      reason:checkReason,
                      attempt:attempt,
                      pageUrl:pageUrl,
                      hasPlayer:hasPlayer,
                      hasGetLevels:hasGetLevels,
                      hasGetCurrent:hasGetCurrent,
                      hasSetRange:hasSetRange,
                      hasSetQuality:hasSetQuality,
                      levels:levels,
                      currentBefore:currentBefore,
                      currentAfter:currentAfter,
                      target:target,
                      methodsApplied:methodsApplied,
                      videoWidthBefore:widthBefore,
                      videoHeightBefore:heightBefore,
                      videoWidthAfter:widthAfter,
                      videoHeightAfter:heightAfter
                    }),'');
                  }catch(reportError){
                    try{
                      window.prompt(promptPrefix+JSON.stringify({
                        type:'youtube-quality-helper',
                        action:'error',
                        reason:String(reportError&&reportError.message||reportError),
                        attempt:attempt,
                        pageUrl:pageUrl
                      }),'');
                    }catch(_){}
                  }
                }, 1000);
              }catch(error){
                try{
                  window.prompt(${escapedPromptPrefix}+JSON.stringify({
                    type:'youtube-quality-helper',
                    action:'error',
                    reason:String(error&&error.message||error),
                    attempt:${attempt},
                    pageUrl:(window.location&&window.location.href)||''
                  }),'');
                }catch(_){}
              }
            })();
        """.trimIndent()
    }
}
