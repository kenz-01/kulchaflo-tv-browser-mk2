package com.kulchaflo.tv.mk2.web

import android.net.Uri
import com.kulchaflo.tv.mk2.util.Logger

class WebCompatRegistry {
    data class ZoomDecision(
        val applyZoom: Boolean,
        val scale: Double,
        val reason: String,
    )

    fun onBeforePageLoad(url: String) {
        // Intentionally lean. Most pages should render untouched unless a concrete TV-only
        // compatibility issue is proven.
    }

    fun resolveZoomDecision(url: String, defaultScale: Double): ZoomDecision {
        val parsed = parseUrl(url)
        val isConsent = isYouTubeConsentPage(url)
        val youTubeBranch = resolveYouTubeMatchBranch(url)
        val isYouTube = youTubeBranch != null
        val decision = when {
            isConsent -> ZoomDecision(
                applyZoom = false,
                scale = 1.0,
                reason = "skipped-for-consent",
            )
            isYouTube -> ZoomDecision(
                applyZoom = false,
                scale = 1.0,
                reason = "skipped-for-youtube",
            )
            else -> ZoomDecision(
                applyZoom = true,
                scale = defaultScale,
                reason = "applied-default",
            )
        }
        Logger.i(
            DEBUG_TAG,
            "resolveZoomDecision url=$url host=${parsed.host} normalizedHost=${parsed.normalizedHost} path=${parsed.path} isYouTube=$isYouTube youTubeBranch=${youTubeBranch ?: "none"} isConsent=$isConsent applyZoom=${decision.applyZoom} scale=${decision.scale} reason=${decision.reason}"
        )
        return decision
    }

    fun buildPageFinishedScript(url: String, zoomDecision: ZoomDecision): String {
        val parsed = parseUrl(url)
        val homepageHeroCss = buildHomepageHeroCssOverride(url)
        val escapedCss = homepageHeroCss
            ?.replace("\\", "\\\\")
            ?.replace("`", "\\`")
            ?.replace("$", "\\$")
        val siteMediaActivationScript = buildSiteMediaActivationScript(url)
        Logger.i(
            DEBUG_TAG,
            "buildPageFinishedScript url=$url host=${parsed.host} normalizedHost=${parsed.normalizedHost} path=${parsed.path} cssOverride=${homepageHeroCss != null} mediaScript=${resolveMediaScriptKind(url)} zoomReason=${zoomDecision.reason}"
        )

        return """
            (() => {
              const applyZoom = ${zoomDecision.applyZoom};
              const scale = ${zoomDecision.scale};
              const zoomReason = "${zoomDecision.reason}";
              const mediaLog = (msg) => console.log("KF_MEDIA_FS: " + msg);
              mediaLog("runtime branch=buildPageFinishedScript url=" + location.href + " zoomReason=" + zoomReason + " mediaScript=${resolveMediaScriptKind(url)}");
              if (applyZoom) {
                document.documentElement.style.zoom = scale;
                mediaLog("document zoom applied scale=" + scale + " reason=" + zoomReason + " url=" + location.href);
              } else {
                document.documentElement.style.zoom = "";
                mediaLog("document zoom skipped reason=" + zoomReason + " url=" + location.href);
              }

              const installFullscreenLogging = () => {
                if (window.__kfMk2FullscreenHooksInstalled) return;
                window.__kfMk2FullscreenHooksInstalled = true;

                const wrapMethod = (prototype, methodName, label) => {
                  const original = prototype && prototype[methodName];
                  if (typeof original !== "function" || original.__kfMk2Wrapped) return;
                  const wrapped = function(...args) {
                    try {
                      mediaLog("request label=" + label + " node=" + (this && this.tagName ? this.tagName : "unknown"));
                    } catch (_ignored) {}
                    return original.apply(this, args);
                  };
                  wrapped.__kfMk2Wrapped = true;
                  prototype[methodName] = wrapped;
                };

                wrapMethod(Element.prototype, "requestFullscreen", "requestFullscreen");
                wrapMethod(Element.prototype, "webkitRequestFullscreen", "webkitRequestFullscreen");

                const emitFullscreenState = (reason) => {
                  const active = document.fullscreenElement || document.webkitFullscreenElement;
                  mediaLog("event=" + reason + " active=" + !!active + " node=" + (active && active.tagName ? active.tagName : "none"));
                };

                document.addEventListener("fullscreenchange", () => emitFullscreenState("fullscreenchange"), true);
                document.addEventListener("webkitfullscreenchange", () => emitFullscreenState("webkitfullscreenchange"), true);
              };
              installFullscreenLogging();

              const css = ${if (escapedCss != null) "`$escapedCss`" else "null"};
              if (css) {
                const styleId = "kf-tv-homepage-hero-compat";
                let style = document.getElementById(styleId);
                if (!style) {
                  style = document.createElement("style");
                  style.id = styleId;
                  document.head.appendChild(style);
                }
                if (style.textContent !== css) {
                  style.textContent = css;
                }
              }

              ${siteMediaActivationScript ?: ""}
              return scale;
            })();
        """.trimIndent()
    }

    private fun buildHomepageHeroCssOverride(url: String): String? {
        if (!isKulchaFloHomepage(url)) return null
        return """
            .kf-hero-inner {
              min-height: 302px !important;
              gap: 18px !important;
              padding: 20px 22px !important;
            }
            .kf-hero-copy {
              flex: 0 0 472px !important;
              width: 472px !important;
              max-width: 472px !important;
              min-width: 472px !important;
              margin-left: 4px !important;
              padding: 12px 14px !important;
            }
            .kf-hero-title {
              margin: 0 0 3px !important;
            }
            .kf-hero-tag {
              margin: 0 0 6px !important;
            }
            .kf-hero-desc {
              max-width: 42ch !important;
              line-height: 1.48 !important;
            }
            .kf-hero-actions {
              margin-top: 10px !important;
              gap: 6px !important;
            }
        """.trimIndent()
    }

    private fun buildSiteMediaActivationScript(url: String): String? {
        val parsed = parseUrl(url)
        val youTubeBranch = resolveYouTubeMatchBranch(url)
        val script = when {
            isYouTubeConsentPage(url) -> buildYouTubeConsentScript()
            youTubeBranch != null -> buildYouTubeActivationScript()
            isFacebookPage(url) -> buildFacebookDiagnosticsScript()
            else -> null
        }
        Logger.i(
            DEBUG_TAG,
            "buildSiteMediaActivationScript url=$url host=${parsed.host} normalizedHost=${parsed.normalizedHost} path=${parsed.path} selected=${resolveMediaScriptKind(url)} youTubeBranch=${youTubeBranch ?: "none"}"
        )
        return script
    }

    private fun buildYouTubeConsentScript(): String {
        return """
            (() => {
              if (window.__kfMk2YouTubeConsentHandled) {
                console.log("KF_YT_CONSENT: already installed url=" + location.href);
                return;
              }
              window.__kfMk2YouTubeConsentHandled = true;

              const log = (msg) => console.log("KF_YT_CONSENT: " + msg);
              const isVisible = (el) => {
                if (!el) return false;
                const rect = el.getBoundingClientRect();
                return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 &&
                  rect.top < window.innerHeight && rect.left < window.innerWidth;
              };
              const labelOf = (el) => {
                return (
                  el.getAttribute("aria-label") ||
                  el.textContent ||
                  el.value ||
                  el.name ||
                  ""
                ).trim().replace(/\s+/g, " ").slice(0, 120);
              };
              const dispatchRichClick = (target) => {
                if (!target) return false;
                ["pointerdown", "mousedown", "pointerup", "mouseup", "click"].forEach((type) => {
                  target.dispatchEvent(new MouseEvent(type, {
                    view: window,
                    bubbles: true,
                    cancelable: true,
                    buttons: 1
                  }));
                });
                return true;
              };
              const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"], [role="button"]'));
              const forms = Array.from(document.querySelectorAll("form"));
              const actions = forms.map((form) => ({
                action: form.getAttribute("action") || "",
                method: form.getAttribute("method") || "get"
              }));
              log("url=" + location.href + " buttons=" + buttons.length + " forms=" + forms.length + " formActions=" + JSON.stringify(actions));
              buttons.slice(0, 12).forEach((button, index) => {
                log("button[" + index + "] label=" + JSON.stringify(labelOf(button)));
              });

              const consentMatch = buttons.find((button) => {
                const label = labelOf(button).toLowerCase();
                return isVisible(button) && (
                  label.includes("accept all") ||
                  label.includes("i agree") ||
                  label.includes("accept") ||
                  label.includes("continue to youtube") ||
                  label.includes("continue") ||
                  label.includes("reject all") === false && label.includes("agree")
                );
              });

              if (consentMatch) {
                log("clicking consent button label=" + JSON.stringify(labelOf(consentMatch)));
                dispatchRichClick(consentMatch);
                return;
              }

              const consentForm = forms.find((form) => {
                const action = (form.getAttribute("action") || "").toLowerCase();
                return action.includes("save") || action.includes("continue") || action.includes("consent");
              });

              if (consentForm) {
                log("submitting consent form action=" + JSON.stringify(consentForm.getAttribute("action") || ""));
                if (typeof consentForm.requestSubmit === "function") {
                  consentForm.requestSubmit();
                } else {
                  consentForm.submit();
                }
                return;
              }

              log("no deterministic consent action found");
            })();
        """.trimIndent()
    }

    private fun buildYouTubeActivationScript(): String {
        return """
            (() => {
              if (window.__kfMk2YouTubeFullscreenScheduled) {
                console.log("KF_YT_FULLSCREEN: already scheduled for this page");
                return;
              }
              window.__kfMk2YouTubeFullscreenScheduled = true;

              const log = (msg) => console.log("KF_YT_FULLSCREEN: " + msg);
              const isVisible = (el) => {
                if (!el) return false;
                const rect = el.getBoundingClientRect();
                return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 &&
                  rect.top < window.innerHeight && rect.left < window.innerWidth;
              };
              const dispatchRichClick = (target) => {
                if (!target) return false;
                ["pointerover", "mouseover", "mousemove", "pointerdown", "mousedown", "pointerup", "mouseup", "click"].forEach((type) => {
                  target.dispatchEvent(new MouseEvent(type, {
                    view: window,
                    bubbles: true,
                    cancelable: true,
                    buttons: 1
                  }));
                });
                return true;
              };
              const tryFs = (node, label) => {
                if (!node) {
                  log("fullscreen target missing label=" + label);
                  return false;
                }
                const fn = node.requestFullscreen || node.webkitRequestFullscreen;
                if (typeof fn === "function") {
                  log("request fullscreen source=registry-youtube-activation label=" + label + " node=" + node.tagName);
                  fn.call(node);
                  return true;
                }
                log("no fullscreen function label=" + label + " node=" + node.tagName);
                return false;
              };
              const findVisible = (selectors) => {
                for (const selector of selectors) {
                  const candidates = Array.from(document.querySelectorAll(selector));
                  const match = candidates.find(isVisible);
                  log("scan selector=" + selector + " candidates=" + candidates.length + " matched=" + !!match);
                  if (match) return { selector, node: match };
                }
                return null;
              };
              const describeNode = (node) => {
                if (!node) return "none";
                const tag = node.tagName || "unknown";
                const id = node.id ? ("#" + node.id) : "";
                const cls = typeof node.className === "string"
                  ? node.className.split(/\s+/).filter(Boolean).slice(0, 3).map((name) => "." + name).join("")
                  : "";
                return tag + id + cls;
              };
              const pageKind = () => {
                const path = location.pathname || "";
                if (path.startsWith("/watch")) return "watch";
                if (path.startsWith("/playlist")) return "playlist";
                if (path.startsWith("/shorts")) return "shorts";
                if (path.startsWith("/live")) return "live";
                if (path.startsWith("/channel/")) return "channel";
                if (path.startsWith("/c/")) return "custom-channel";
                if (path.startsWith("/user/")) return "user-channel";
                if (path.startsWith("/@")) return "handle-channel";
                if (path.startsWith("/embed")) return "embed";
                return "other";
              };
              const isWatchPlaybackPage = (kind) => {
                return kind === "watch" || kind === "shorts" || kind === "live" || kind === "embed";
              };
              const attempt = (phase) => {
                const kind = pageKind();
                const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
                const player = document.querySelector("#movie_player") ||
                  document.querySelector(".html5-video-player") ||
                  document.querySelector("ytd-player");
                const video = Array.from(document.querySelectorAll("video")).find(isVisible);
                const playerContainer = player || (video ? (video.closest(".html5-video-player") || video) : null);
                const targetNode = playerContainer || video || null;
                const targetLabel = describeNode(targetNode);
                const fullscreenButton = findVisible([
                  ".ytp-fullscreen-button",
                  "button[aria-keyshortcuts='f']",
                  "button[title*='Full screen']",
                  "button[aria-label*='Full screen']"
                ]);
                const watchFlexy = document.querySelector("ytd-watch-flexy");
                const watchState = watchFlexy ? {
                  theater: watchFlexy.hasAttribute("theater"),
                  fullscreen: watchFlexy.hasAttribute("fullscreen"),
                  isTwoColumns: watchFlexy.hasAttribute("is-two-columns_")
                } : null;
                log("phase=" + phase + " url=" + location.href + " pageKind=" + kind + " isWatchPlaybackPage=" + isWatchPlaybackPage(kind) + " consentHost=" + (location.hostname === "consent.youtube.com") + " isFs=" + isFs + " hasPlayer=" + !!player + " hasVideo=" + !!video + " hasFsButton=" + !!fullscreenButton + " fullscreenEnabled=" + document.fullscreenEnabled + " targetNode=" + targetLabel + " watchState=" + JSON.stringify(watchState));
                if (isFs) {
                  log("phase=" + phase + " already fullscreen");
                  return;
                }
                if (!isWatchPlaybackPage(kind)) {
                  log("phase=" + phase + " skip fullscreen reason=navigation-page pageKind=" + kind);
                  return;
                }

                if (player) {
                  dispatchRichClick(player);
                }

                const playMatch = findVisible([
                  ".ytp-large-play-button",
                  ".ytp-play-button",
                  "button[aria-label*='Play']"
                ]);
                if (video && video.paused && playMatch) {
                  log("phase=" + phase + " clicking play selector=" + playMatch.selector);
                  dispatchRichClick(playMatch.node);
                } else if (video) {
                  log("phase=" + phase + " video paused=" + video.paused);
                }

                const fullscreenMatch = fullscreenButton;
                if (fullscreenMatch) {
                  log("phase=" + phase + " clicking fullscreen selector=" + fullscreenMatch.selector + " targetNode=" + targetLabel);
                  dispatchRichClick(fullscreenMatch.node);
                  return;
                }

                if (playerContainer) {
                  log("phase=" + phase + " fallback target=youtube-player-container node=" + describeNode(playerContainer));
                  if (tryFs(playerContainer, "youtube-player-container")) return;
                }
                if (video) {
                  log("phase=" + phase + " fallback target=youtube-video node=" + describeNode(video));
                  if (tryFs(video, "youtube-video")) return;
                }

                if (video && video.paused) {
                  video.play().then(() => {
                    log("phase=" + phase + " fallback video.play() succeeded");
                  }).catch((error) => {
                    log("phase=" + phase + " fallback video.play() failed error=" + error.message);
                  });
                } else {
                  log("phase=" + phase + " no fullscreen action succeeded");
                }
              };

              [350, 1100, 2200].forEach((delay, index) => {
                const phase = ["initial", "retry_1", "retry_2"][index];
                setTimeout(() => attempt(phase), delay);
              });
            })();
        """.trimIndent()
    }

    private fun buildFacebookDiagnosticsScript(): String {
        return """
            (() => {
              if (window.__kfMk2FacebookDiagnosticsInstalled) {
                console.log("KF_FB_HANDOFF: diagnostics already installed");
                return;
              }
              window.__kfMk2FacebookDiagnosticsInstalled = true;
              const log = (msg) => console.log("KF_FB_HANDOFF: " + msg);
              const isVisible = (el) => {
                if (!el) return false;
                const rect = el.getBoundingClientRect();
                return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 &&
                  rect.top < window.innerHeight && rect.left < window.innerWidth;
              };
              const getFrameInfo = () => {
                return Array.from(document.querySelectorAll("iframe")).map((frame, index) => {
                  try {
                    const doc = frame.contentDocument;
                    const href = frame.contentWindow && frame.contentWindow.location ? frame.contentWindow.location.href : "unknown";
                    const videos = doc ? Array.from(doc.querySelectorAll("video")) : [];
                    const buttons = doc ? doc.querySelectorAll('[aria-label*="Play"], [aria-label*="fullscreen"], [data-testid*="video"]').length : 0;
                    return { index, href, accessible: !!doc, totalVideos: videos.length, visibleVideos: videos.filter(isVisible).length, buttonLikeCount: buttons };
                  } catch (_error) {
                    return { index, href: "cross-origin", accessible: false, totalVideos: -1, visibleVideos: -1, buttonLikeCount: -1 };
                  }
                });
              };
              const snapshot = (phase) => {
                const videos = Array.from(document.querySelectorAll("video"));
                const playButtons = document.querySelectorAll('[aria-label*="Play"], [aria-label*="play"]').length;
                const fsButtons = document.querySelectorAll('[aria-label*="fullscreen"], [aria-label*="Full Screen"]').length;
                const playerContainers = document.querySelectorAll('[data-testid="video_player_container"], [role="application"], [data-instancekey]').length;
                const shadowHosts = Array.from(document.querySelectorAll("*")).filter((node) => !!node.shadowRoot).length;
                log("diag phase=" + phase + " url=" + location.href + " host=" + location.hostname + " mobileStyle=" + location.hostname.startsWith("m.") + " desktopStyle=" + (location.hostname === "www.facebook.com" || location.hostname === "facebook.com") + " visibleVideos=" + videos.filter(isVisible).length + " totalVideos=" + videos.length + " iframes=" + document.querySelectorAll("iframe").length + " shadowHosts=" + shadowHosts + " playerContainers=" + playerContainers + " playButtons=" + playButtons + " fullscreenButtons=" + fsButtons);
                log("diag phase=" + phase + " frameInfo=" + JSON.stringify(getFrameInfo()));
              };
              [250, 1000, 2500].forEach((delay, index) => {
                const phase = ["page_probe_1", "page_probe_2", "page_probe_3"][index];
                setTimeout(() => snapshot(phase), delay);
              });
            })();
        """.trimIndent()
    }

    private fun isKulchaFloHomepage(url: String): Boolean {
        val parsed = parseUrl(url)
        val host = parsed.normalizedHost ?: return false
        if (host != "kulchaflo.com") return false
        val path = parsed.path
        return path.isBlank() || path == "/"
    }

    private fun isYouTubePage(url: String): Boolean {
        return resolveYouTubeMatchBranch(url) != null
    }

    private fun resolveYouTubeMatchBranch(url: String): String? {
        val parsed = parseUrl(url)
        val host = parsed.normalizedHost ?: return null
        if (host == "youtu.be") return "youtu-be"
        if (host != "youtube.com" && host != "m.youtube.com") return null
        val path = parsed.path
        return when {
            path.startsWith("/watch") -> "watch"
            path.startsWith("/playlist") -> "playlist"
            path.startsWith("/shorts") -> "shorts"
            path.startsWith("/live") -> "live"
            path.startsWith("/embed") -> "embed"
            path.startsWith("/channel/") -> "channel"
            path.startsWith("/c/") -> "custom-channel"
            path.startsWith("/user/") -> "user-channel"
            path.startsWith("/@") -> "handle-channel"
            else -> null
        }
    }

    private fun isYouTubeConsentPage(url: String): Boolean {
        val parsed = parseUrl(url)
        val host = parsed.host ?: return false
        return host == "consent.youtube.com"
    }

    private fun isFacebookPage(url: String): Boolean {
        val parsed = parseUrl(url)
        val host = parsed.normalizedHost ?: return false
        return host == "facebook.com" || host == "m.facebook.com" || host == "fb.watch" || host.endsWith(".facebook.com")
    }

    private fun resolveMediaScriptKind(url: String): String {
        return when {
            isYouTubeConsentPage(url) -> "youtube-consent"
            resolveYouTubeMatchBranch(url) != null -> "youtube-activation"
            isFacebookPage(url) -> "facebook-diagnostics"
            else -> "none"
        }
    }

    private fun parseUrl(url: String): ParsedUrl {
        val uri = Uri.parse(url)
        val host = uri.host?.lowercase()
        return ParsedUrl(
            host = host,
            normalizedHost = host?.removePrefix("www."),
            path = uri.encodedPath.orEmpty(),
        )
    }

    private data class ParsedUrl(
        val host: String?,
        val normalizedHost: String?,
        val path: String,
    )

    private companion object {
        private const val DEBUG_TAG = "KfWebCompatDebug"
    }
}
