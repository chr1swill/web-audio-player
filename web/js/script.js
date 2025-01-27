"use strict";
(function main() {
    var inputEl = document.getElementById("file_picker");
    if (inputEl === null) {
        throw new ReferenceError("Error no element with id: #file_picker");
    }
    function getWavDurationInSeconds(wavBuffer) {
        const dataView = new DataView(wavBuffer);
        const numChannels = dataView.getUint16(22, true); // nChannels byte 22
        const sampleRate = dataView.getUint32(24, true); // sampleRate byte 24
        const bitsPerSample = dataView.getUint16(34, true); // bitsPerSample byte 34
        // Initialize variables for data chunk size and fact chunk size
        let dataChunkSize = 0;
        let hasFactChunk = false;
        const CHUNK_OFFSET_AFTER_FMT = 0x26;
        let cursor = CHUNK_OFFSET_AFTER_FMT;
        const chunkId = new Uint8Array(wavBuffer.slice(CHUNK_OFFSET_AFTER_FMT, CHUNK_OFFSET_AFTER_FMT + 4), 0, 4);
        console.log(`chunkId=(${chunkId})`);
        const chunkIdStr = String.fromCharCode(...chunkId);
        console.log(`chunkIdStr=(${chunkIdStr})`);
        if (chunkIdStr === 'data') {
            cursor += 4; // move to ckSize
            dataChunkSize = dataView.getUint32(cursor, true);
        }
        else if (chunkIdStr === 'fact') {
            hasFactChunk = true;
            cursor += 4; // move cursor past 'fact' byte
            const LEN = wavBuffer.byteLength - cursor;
            for (; cursor < LEN; cursor++) {
                let maybeChunkId = new Uint8Array(wavBuffer.slice(cursor, cursor + 4), 0, 4);
                if (String.fromCharCode(...maybeChunkId) !== 'data') {
                    continue;
                }
                else {
                    cursor += 4; // move to ckSize
                    dataChunkSize = dataView.getUint32(cursor, true);
                    break;
                }
            }
        }
        else {
            throw new ReferenceError(`No hanlder for chunk type ${String.fromCharCode(...chunkId)}`);
        }
        const duration = dataChunkSize / (sampleRate * numChannels * (bitsPerSample / 8));
        return duration;
    }
    inputEl.onchange = function (e) {
        const file = inputEl !== null && inputEl.files ? inputEl === null || inputEl === void 0 ? void 0 : inputEl.files[0] : null;
        if (!file || file.type !== "audio/wav") {
            console.error("Error loading file: did not receive a valid .wav file.");
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
            const view = new DataView(arrayBuffer);
            const durationInSeconds = getWavDurationInSeconds(arrayBuffer);
            console.log(`durationInSeconds=${durationInSeconds}`);
            return;
        };
        fr.readAsArrayBuffer(file);
    };
})();
