const { ipcRenderer } = require("electron");

module.exports.seekTo = function seekTo(t) {
    document.querySelector('video').currentTime = t;
}

module.exports.seek = function seek(o) {
    document.querySelector('video').currentTime += o;
}

module.exports.setupSongControls = () => {
	ipcRenderer.on("seekTo", async (_, t) => seekTo(t));
};


