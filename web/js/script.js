"use strict";
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
        return;
    };
})();
