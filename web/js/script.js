"use strict";
function RiffChunkPrint(rc) {
    console.log("rc.chunkId: ", String.fromCharCode(...rc.chunkId));
    //console.log("rc.ckSize: ", ...rc.ckSize);
}
(function main() {
    var inputEl = document.getElementById("file_picker");
    if (inputEl === null) {
        throw new ReferenceError("Error no element with id: #file_picker");
    }
    inputEl.onchange = function (e) {
        const file = inputEl !== null && inputEl.files ? inputEl === null || inputEl === void 0 ? void 0 : inputEl.files[0] : null;
        if (!file || !(file.type.includes("audio/"))) {
            console.error("Error loading file: please provide a valid .wav file.");
            return;
        }
        console.log("files: ", file);
        var fr = new FileReader();
        fr.onerror = function (e) {
            console.error("Error occured reading file: ", fr.error);
            return;
        };
        fr.onload = function (e) {
            const arrayBuffer = fr.result;
            console.log("ArrayBuffer: ", arrayBuffer);
            //const view: DataView  = new DataView(arrayBuffer);
            //console.log("view: ", view);
            //console.log("view.getInt8(0): ", String.fromCharCode(view.getInt8(0)));
            //console.log("view.getInt8(1): ", String.fromCharCode(view.getInt8(1)));
            //console.log("view.getInt8(3): ", String.fromCharCode(view.getInt8(3))); 
            //console.log("view.getInt8(2): ", String.fromCharCode(view.getInt8(2)));
            const rc = {
                chunkId: new Uint8Array(arrayBuffer.slice(0, 4), 0, 4),
                //ckSize: new Uint32Array(arrayBuffer.slice(5, 9), 0, 1),
            };
            RiffChunkPrint(rc);
            return;
        };
        fr.readAsArrayBuffer(file);
    };
})();
