package com.kulchaflo.tv.mk2.web

import android.webkit.WebView
import com.kulchaflo.tv.mk2.util.Logger

class FacebookMediaHandoffHandler(private val webView: WebView) {

    /**
     * Intercepts Facebook custom schemes and attempts to trigger in-page video fullscreen.
     * We prefer clicking actual UI elements to ensure transport controls are visible.
     */
    fun handleFacebookScheme(url: String): Boolean {
        Logger.i(TAG, "intercepted facebook custom scheme url=$url")

        if (url.startsWith("fb://fullscreen_video/") || url.startsWith("fb://video/")) {
            // First pass immediate
            runAdvancedHandoffScript("first_pass")
            
            // Second pass delayed because Facebook UI can be lazy
            webView.postDelayed({
                runAdvancedHandoffScript("second_pass_delayed")
            }, 500L)
            
            return true
        }

        // Block other fb:// schemes from navigating to error pages
        Logger.w(TAG, "blocking unsupported facebook scheme url=$url")
        return true
    }

    private fun runAdvancedHandoffScript(phase: String) {
        val script = """
            (function() {
                try {
                    const log = (msg) => console.log('KF_FB_HANDOFF: ' + msg);
                    const isVisible = (el) => {
                        if (!el) return false;
                        const rect = el.getBoundingClientRect();
                        return rect.width > 0 && rect.height > 0 && 
                               rect.bottom > 0 && rect.right > 0 && 
                               rect.top < window.innerHeight && rect.left < window.innerWidth;
                    };

                    const getAccessibleFrames = () => {
                        const frames = Array.from(document.querySelectorAll('iframe'));
                        return frames.map((frame, index) => {
                            try {
                                const doc = frame.contentDocument;
                                const href = frame.contentWindow && frame.contentWindow.location ? frame.contentWindow.location.href : 'unknown';
                                return { frame, index, doc, href, accessible: !!doc };
                            } catch (_error) {
                                return { frame, index, doc: null, href: 'cross-origin', accessible: false };
                            }
                        });
                    };

                    const dispatchRichClick = (target) => {
                        if (!target) return false;
                        ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach((type) => {
                            target.dispatchEvent(new MouseEvent(type, {
                                view: window,
                                bubbles: true,
                                cancelable: true,
                                buttons: 1
                            }));
                        });
                        return true;
                    };

                    const findAndClick = (selectors, label) => {
                        for (const selector of selectors) {
                            const elements = Array.from(document.querySelectorAll(selector));
                            log('scan ' + label + ' selector=' + selector + ' candidates=' + elements.length);
                            const target = elements.find(isVisible);
                            if (target) {
                                log('click ' + label + ' selector=' + selector);
                                dispatchRichClick(target);
                                return true;
                            }
                        }
                        return false;
                    };

                    const describeTarget = (el) => {
                        if (!el) return 'none';
                        const parts = [];
                        parts.push(el.tagName || 'unknown');
                        if (el.id) parts.push('#' + el.id);
                        const cls = (el.className && typeof el.className === 'string')
                            ? el.className.trim().split(/\s+/).slice(0, 3).join('.')
                            : '';
                        if (cls) parts.push('.' + cls);
                        const label = (
                            el.getAttribute('aria-label') ||
                            el.getAttribute('data-testid') ||
                            el.getAttribute('role') ||
                            ''
                        ).trim();
                        if (label) parts.push('[' + label.slice(0, 40) + ']');
                        return parts.join('');
                    };

                    const dispatchSyntheticClick = (el) => {
                        if (!el) return false;
                        const rect = el.getBoundingClientRect();
                        const x = rect.left + rect.width / 2;
                        const y = rect.top + rect.height / 2;
                        
                        const evt = new MouseEvent('click', {
                            view: window,
                            bubbles: true,
                            cancelable: true,
                            clientX: x,
                            clientY: y
                        });
                        log('dispatching synthetic click at ' + x + ',' + y);
                        return el.dispatchEvent(evt);
                    };

                    const tryFs = (node, label) => {
                        if (!node) {
                            log('fullscreen target missing label=' + label);
                            return false;
                        }
                        const fn = node.requestFullscreen || node.webkitRequestFullscreen || node.mozRequestFullScreen || node.msRequestFullscreen;
                        if (fn) {
                            log('request fullscreen label=' + label + ' node=' + node.tagName);
                            fn.call(node);
                            return true;
                        }
                        log('no fullscreen function label=' + label + ' node=' + node.tagName);
                        return false;
                    };

                    // 1. Locate best visible video element
                    const videos = Array.from(document.querySelectorAll('video'));
                    const frames = getAccessibleFrames();
                    const fbVideoContainers = Array.from(document.querySelectorAll(
                        '[data-testid*="video"], [data-instancekey], [role="application"], [aria-label*="video" i], [aria-label*="reel" i]'
                    ));
                    const fbPlayButtons = Array.from(document.querySelectorAll(
                        '[aria-label*="Play" i], [aria-label*="Watch" i], [aria-label*="fullscreen" i], div[role="button"], [tabindex="0"]'
                    ));
                    const playerRegions = Array.from(document.querySelectorAll(
                        '[role="application"], [role="region"], [data-pagelet], [data-visualcompletion]'
                    ));
                    const frameDiagnostics = frames.map(({ index, doc, href, accessible }) => {
                        const frameVideos = doc ? Array.from(doc.querySelectorAll('video')) : [];
                        const frameButtons = doc ? doc.querySelectorAll('[aria-label*="Play"], [aria-label*="fullscreen"], [data-testid*="video"]').length : 0;
                        return {
                            index,
                            href,
                            accessible,
                            totalVideos: frameVideos.length,
                            visibleVideos: frameVideos.filter(isVisible).length,
                            buttonLikeCount: frameButtons
                        };
                    });
                    const topLevelPlayButtons = document.querySelectorAll('[aria-label*="Play"], [aria-label*="fullscreen"], [data-testid*="video"], div[role="button"]').length;
                    const shadowHosts = Array.from(document.querySelectorAll('*')).filter((node) => !!node.shadowRoot).length;
                    const desktopStyle = location.hostname === 'www.facebook.com' || location.hostname === 'facebook.com';
                    const mobileStyle = location.hostname === 'm.facebook.com' || location.hostname.startsWith('m.');
                    const v = videos.find(isVisible);
                    const visibleContainer = fbVideoContainers.find(isVisible);
                    const visiblePlayButton = fbPlayButtons.find(isVisible);
                    const visiblePlayerRegion = playerRegions.find(isVisible);
                    log('phase=$phase url=' + location.href + ' host=' + location.hostname + ' mobileStyle=' + mobileStyle + ' desktopStyle=' + desktopStyle);
                    log('phase=$phase visibleVideos=' + videos.filter(isVisible).length + ' totalVideos=' + videos.length + ' iframes=' + frames.length + ' shadowHosts=' + shadowHosts + ' topLevelButtonLike=' + topLevelPlayButtons + ' visibleContainers=' + fbVideoContainers.filter(isVisible).length + ' visibleButtons=' + fbPlayButtons.filter(isVisible).length + ' visibleRegions=' + playerRegions.filter(isVisible).length);
                    log('phase=$phase frameDiagnostics=' + JSON.stringify(frameDiagnostics));
                    
                    if (v) {
                        log('visible video found target=' + describeTarget(v));
                        v.setAttribute('playsinline', 'false');
                        v.webkitPlaysInline = false;
                        v.muted = false;

                        // 2. Identify likely player container
                        const container = v.closest('[data-testid="video_player_container"]') || 
                                          v.closest('[role="application"]') ||
                                          v.closest('[data-instancekey]') ||
                                          v.closest('.x1yztbdb') || 
                                          v.parentElement;
                        const overlay = v.closest('[data-testid]') || container;

                        // Wake controls before looking for UI.
                        dispatchRichClick(overlay || container || v);

                        // 3. Try to find and click real UI buttons first
                        const playSelectors = [
                            '[aria-label="Play Video"]',
                            '[aria-label="Play"]',
                            '[aria-label="Play video"]',
                            '[data-testid="video-play-button"]',
                            'div[role="button"][aria-label*="Play"]',
                            'button[type="submit"]'
                        ];
                        if (findAndClick(playSelectors, 'play')) return "visible-video-found target=" + describeTarget(v) + " action=clicked_play_button";

                        const fsSelectors = [
                            '[aria-label="Full Screen"]',
                            '[aria-label="Enter fullscreen"]',
                            '[aria-label="Fullscreen"]',
                            '[aria-label*="full screen"]',
                            '[aria-label*="fullscreen"]',
                            'div[role="button"][aria-label*="fullscreen"]'
                        ];
                        if (findAndClick(fsSelectors, 'fullscreen')) return "visible-video-found target=" + describeTarget(v) + " action=clicked_fullscreen_button";

                        // 4. Try activating the player surface before falling back to raw playback.
                        if (dispatchSyntheticClick(overlay || container || v)) {
                            log('synthetic player activation dispatched');
                        }

                        // 5. Try Fullscreen API fallback
                        if (tryFs(container, 'container')) return "visible-video-found target=" + describeTarget(container) + " action=fullscreen_requested_on_container";
                        if (tryFs(v, 'video')) return "visible-video-found target=" + describeTarget(v) + " action=fullscreen_requested_on_video";

                        // 6. Last resort: raw playback poke only after control attempts fail.
                        v.controls = true;
                        v.play().then(() => {
                            log('fallback raw video.play() succeeded');
                        }).catch(e => {
                            log('fallback raw video.play() error=' + e.message);
                        });
                        return "visible-video-found target=" + describeTarget(v) + " action=fell_back_to_video_play";
                    } else {
                        if (visibleContainer || visiblePlayButton || visiblePlayerRegion) {
                            const target = visiblePlayButton || visibleContainer || visiblePlayerRegion;
                            const targetKind = visiblePlayButton ? 'play-button' : (visibleContainer ? 'video-container' : 'player-region');
                            log('phase=$phase visible non-video target found kind=' + targetKind + ' target=' + describeTarget(target));
                            dispatchRichClick(target);
                            return "visible-video-found target=" + describeTarget(target) + " action=clicked_non_video_target kind=" + targetKind;
                        }
                        const frameWithVideo = frames.find(({ doc }) => {
                            if (!doc) return false;
                            return Array.from(doc.querySelectorAll('video')).some(isVisible);
                        });
                        if (frameWithVideo && frameWithVideo.doc) {
                            log('phase=$phase attempting same-origin iframe activation frame=' + frameWithVideo.index + ' href=' + frameWithVideo.href);
                            const frameDoc = frameWithVideo.doc;
                            const frameVideos = Array.from(frameDoc.querySelectorAll('video'));
                            const frameVideo = frameVideos.find(isVisible);
                            const frameFsButton = Array.from(
                                frameDoc.querySelectorAll('[aria-label*="fullscreen"], [aria-label*="Full Screen"], [aria-label*="Enter fullscreen"]')
                            ).find(isVisible);
                            if (frameFsButton) {
                                dispatchRichClick(frameFsButton);
                                return "visible-video-found target=iframe-fullscreen-button action=clicked_same_origin_iframe_fullscreen";
                            }
                            if (frameVideo) {
                                const fn = frameVideo.requestFullscreen || frameVideo.webkitRequestFullscreen;
                                if (fn) {
                                    fn.call(frameVideo);
                                    return "visible-video-found target=iframe-video action=requested_same_origin_iframe_video_fullscreen";
                                }
                            }
                        }
                    }

                    return "no_visible_video_found checked=video,video-container,play-button,player-region,iframe-video";
                } catch (e) {
                    console.log('KF_FB_HANDOFF: error=' + e.message);
                    return "error: " + e.message;
                }
            })();
        """.trimIndent()

        webView.evaluateJavascript(script) { result ->
            Logger.d(TAG, "[$phase] facebook video handoff result=$result")
        }
    }

    companion object {
        private const val TAG = "FacebookHandoff"
    }
}
