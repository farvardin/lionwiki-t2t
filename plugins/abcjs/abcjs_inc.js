	function selectionCallback(abcelem) {
		var note = {};
		for (var key in abcelem) {
			if (abcelem.hasOwnProperty(key) && key !== "abselem")
				note[key] = abcelem[key];
		}
		console.log(abcelem);
		var el = document.getElementById("selection");
		el.innerHTML = "<b>selectionCallback parameter:</b><br>" + JSON.stringify(note);
	}

	function initEditor() {
		new ABCJS.Editor("abc", { paper_id: "paper0",
			synth: {
				el: "#audio",
				options: { displayLoop: true, displayRestart: true, displayPlay: true, displayProgress: true, displayWarp: true }
			},
			generate_warnings: true,
			warnings_id:"warnings",
			abcjsParams: {
				generateDownload: true,
				clickListener: selectionCallback,
				tablature: [{instrument: 'mandolin',}]
				//tablature: [{instrument: 'mandolin', label: "Mandolin (%T)", tuning: ["G,", "D", "A", "e"],}]
				//tablature: [{instrument: 'guitar'}]
			}
		});
	}

	window.addEventListener("load", initEditor, false);
