const { globalShortcut, ipcMain } = require("electron");
const is = require("electron-is");
const electronLocalshortcut = require("electron-localshortcut");
const getSongControls = require("../../providers/song-controls");
const { setupMPRIS } = require("./mpris");
const registerCallback = require("../../providers/song-info");
const JSBI = require('jsbi');

function _registerGlobalShortcut(webContents, shortcut, action) {
	globalShortcut.register(shortcut, () => {
		action(webContents);
	});
}

function _registerLocalShortcut(win, shortcut, action) {
	electronLocalshortcut.register(win, shortcut, () => {
		action(win.webContents);
	});
}

function registerShortcuts(win, options) {
	const songControls = getSongControls(win);
	const { playPause, next, previous, search } = songControls;

	if (options.overrideMediaKeys) {
		_registerGlobalShortcut(win.webContents, "MediaPlayPause", playPause);
		_registerGlobalShortcut(win.webContents, "MediaNextTrack", next);
		_registerGlobalShortcut(win.webContents, "MediaPreviousTrack", previous);
	}

	_registerLocalShortcut(win, "CommandOrControl+F", search);
	_registerLocalShortcut(win, "CommandOrControl+L", search);

	if (is.linux()) {
		try {
			const secToMicro = n => Math.round(Number(n) * 1000 * 1000);
			const microToSec = n => Math.round(Number(n) / 1000 / 1000);

			const seekTo = e => win.webContents.send("seekTo", microToSec(e.position));
			const seek = o => win.webContents.send("seek", microToSec(o));

			const mprisPlayer = setupMPRIS();

			const mprisSeek = p => {
				mprisPlayer.interfaces.player.SetPosition(null, JSBI.BigInt(p));
				mprisPlayer.seeked(p);
			}
			win.webContents.send("registerOnSeek");

			ipcMain.on('seeked', (_, t) => mprisSeek(secToMicro(t)));

			let currentSeconds = 0;
			ipcMain.on('timeChanged', (_, t) => currentSeconds = t);

			mprisPlayer.getPosition = () => secToMicro(currentSeconds)

			mprisPlayer.on("raise", () => {
				win.setSkipTaskbar(false);
				win.show();
			});

			mprisPlayer.on("play", () => {
				if (mprisPlayer.playbackStatus !== 'Playing') {
					mprisPlayer.playbackStatus = 'Playing';
					playPause()
				}
			});
			mprisPlayer.on("pause", () => {
				if (mprisPlayer.playbackStatus !== 'Paused') {
					mprisPlayer.playbackStatus = 'Paused';
					playPause()
				}
			});

			mprisPlayer.on("playpause", playPause);
			mprisPlayer.on("next", next);
			mprisPlayer.on("previous", previous);

			mprisPlayer.on('seek', seek);
			mprisPlayer.on('position', console.log); // seekTo);

			registerCallback(songInfo => {
				if (mprisPlayer) {
					mprisPlayer.metadata = {
						'mpris:length': secToMicro(songInfo.songDuration), // In microseconds
						'mpris:artUrl': songInfo.imageSrc,
						'xesam:title': songInfo.title,
						'xesam:artist': songInfo.artist
					};
					mprisSeek(secToMicro(songInfo.elapsedSeconds))
					mprisPlayer.playbackStatus = songInfo.isPaused ? "Paused" : "Playing"
				}
			})

		} catch (e) {
			console.warn("Error in MPRIS", e);
		}
	}

	const { global, local } = options;
	const shortcutOptions = { global, local };

	for (const optionType in shortcutOptions) {
		registerAllShortcuts(shortcutOptions[optionType], optionType);
	}

	function registerAllShortcuts(container, type) {
		for (const action in container) {
			if (!container[action]) {
				continue; // Action accelerator is empty
			}

			console.debug(`Registering ${type} shortcut`, container[action], ":", action);
			if (!songControls[action]) {
				console.warn("Invalid action", action);
				continue;
			}

			if (type === "global") {
				_registerGlobalShortcut(win.webContents, container[action], songControls[action]);
			} else { // type === "local"
				_registerLocalShortcut(win, local[action], songControls[action]);
			}
		}
	}
}

module.exports = registerShortcuts;
