
// ---------- direct-media helper (keep your original implementation) ----------
function fetchVideoDurationInMinutes(url, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
        try {
            const video = document.createElement("video");
            video.preload = "metadata";
            video.crossOrigin = "anonymous";
            let loaded = false;

            const timer = setTimeout(() => {
                if (!loaded) {
                    video.src = "";
                    resolve(null); // timeout -> return null
                }
            }, timeoutMs);

            video.addEventListener(
                "loadedmetadata",
                () => {
                    loaded = true;
                    clearTimeout(timer);
                    const seconds = isFinite(video.duration) ? video.duration : 0;
                    const minutes = Math.max(0, Math.round(seconds / 60)); // integer minutes
                    video.src = "";
                    resolve(minutes);
                },
                { once: true }
            );

            video.addEventListener(
                "error",
                () => {
                    clearTimeout(timer);
                    video.src = "";
                    resolve(null); // cannot load metadata
                },
                { once: true }
            );
            // set src last, triggers load
            video.src = url;
        }
        catch (err) {
            resolve(null); // any host policy / CORS error -> null
        }
    });
}

// ---------- YouTube helpers (no API key needed) ----------
let __ytApiLoading = null;

function loadYouTubeIframeAPI() {
    if (window.YT && window.YT.Player) return Promise.resolve();
    if (__ytApiLoading) return __ytApiLoading;

    __ytApiLoading = new Promise((resolve, reject) => {
        const existing = document.querySelector('script[data-yti="1"]');
        if (!existing) {
            const s = document.createElement("script");
            s.src = "https://www.youtube.com/iframe_api";
            s.async = true;
            s.setAttribute("data-yti", "1");
            document.head.appendChild(s);
        }

        const onApiReady = () => resolve();

        const prev = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = function () {
            try {
                if (typeof prev === "function") prev();
            } catch (e) { }
            onApiReady();
        };

        const to = setInterval(() => {
            if (window.YT && window.YT.Player) {
                clearInterval(to);
                onApiReady();
            }
        }, 50);

        setTimeout(() => {
            if (!(window.YT && window.YT.Player)) {
                reject(new Error("YT iframe API load timeout"));
            }
        }, 12000);
    });
    return __ytApiLoading;
}

function extractYouTubeId(url) {
    if (!url) return null;
    const m = url.match(
        /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{5,})/
    );
    return m ? m[1] : null;
}

// function convertYouTubeToEmbed(url) {
//   if (!url) return null;
//   try {
//     const id = extractYouTubeId(url); // keep your extractYouTubeId helper
//     if (!id) return null;
//     const origin = encodeURIComponent(window.location.origin);
//     return `https://www.youtube.com/embed/${id}?origin=${origin}&rel=0`;
//   } catch (e) {
//     return null;
//   }
// }
function convertYouTubeToEmbed(url) {
    const id = extractYouTubeId(url);
    if (!id) return null;

    // Get current origin safely
    const origin = window.location.origin || 'http://localhost:5173';
    const encodedOrigin = encodeURIComponent(origin);

    // Build URL with proper parameters
    return `https://www.youtube.com/embed/${id}?enablejsapi=1&origin=${encodedOrigin}&rel=0`;
}

async function fetchYouTubeDurationViaIframe(videoUrl, timeoutMs = 10000) {
    try {
        const id = extractYouTubeId(videoUrl);
        if (!id) return null;

        await loadYouTubeIframeAPI();

        return await new Promise((resolve) => {
            const container = document.createElement("div");
            container.style.width = "1px";
            container.style.height = "1px";
            container.style.position = "absolute";
            container.style.left = "-9999px";
            container.style.top = "-9999px";
            document.body.appendChild(container);

            let player = null;
            let settled = false;

            const cleanUp = () => {
                try {
                    if (player && typeof player.destroy === "function") player.destroy();
                }
                catch (e) {
                    console.warn("Player cleanup error:", e);
                }

                if (container.parentNode) container.parentNode.removeChild(container);
                player = null;
            };

            player = new window.YT.Player(container, {
                height: "1",
                width: "1",
                videoId: id,
                playerVars: {
                    controls: 0,
                    enablejsapi: 1,
                },
                events: {
                    onReady: (ev) => {
                        try {
                            const seconds = ev.target.getDuration();
                            const mins =
                                Number.isFinite(seconds) && seconds > 0
                                    ? Math.round(seconds / 60)
                                    : null;
                            settled = true;
                            cleanUp();
                            resolve(mins);
                        }
                        catch (err) {
                            settled = true;
                            cleanUp();
                            resolve(null);
                        }
                    },
                    onError: () => {
                        if (!settled) {
                            settled = true;
                            cleanUp();
                            resolve(null);
                        }
                    },
                },
            });

            setTimeout(() => {
                if (!settled) {
                    settled = true;
                    cleanUp();
                    resolve(null);
                }
            }, Math.max(5000, timeoutMs));
        });
    } catch (err) {
        return null;
    }
}

export { fetchVideoDurationInMinutes, loadYouTubeIframeAPI, extractYouTubeId, convertYouTubeToEmbed, fetchYouTubeDurationViaIframe };
