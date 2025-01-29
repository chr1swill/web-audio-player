"use strict";
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
function secondsToDuration(seconds) {
    if (seconds < 60) {
        return {
            hours: 0,
            minutes: 0,
            seconds: Math.round(seconds),
        };
    }
    else if (seconds > 59 && seconds < 3599) {
        return {
            hours: 0,
            minutes: Math.floor((seconds / 60) % 60),
            seconds: Math.round(seconds % 60),
        };
    }
    else {
        return {
            hours: Math.floor(seconds / 60 / 60),
            minutes: Math.floor((seconds / 60) % 60),
            seconds: Math.round(seconds % 60),
        };
    }
}
function formatAsTime(member) {
    return member < 10 ? member.toString().padStart(2, '0') : member.toString();
}
function durationToString(d) {
    return (`${formatAsTime(d.hours)}:${formatAsTime(d.minutes)}:${formatAsTime(d.seconds)}`);
}
function timeKeeperStateLoading(loaderEl, timeContainerEl) {
    timeContainerEl.style.display = "none";
    loaderEl.style.display = "inline";
}
function timeKeeperSetTime(currentTimeEl, durationEl, currentTime, duration) {
    currentTimeEl.textContent = durationToString(currentTime);
    durationEl.textContent = durationToString(duration);
}
function timeKeeperStateLoaded(loaderEl, timeContainerEl, currentTimeEl, durationEl, currentTime, duration) {
    timeKeeperSetTime(currentTimeEl, durationEl, currentTime, duration);
    loaderEl.style.display = "none";
    timeContainerEl.style.display = "inline";
}
function getElementById(id) {
    const el = document.getElementById(id);
    if (el === null) {
        throw new ReferenceError(`Error no element with id: #${id}`);
    }
    else {
        return el;
    }
}
(function main() {
    const inputEl = getElementById("file_picker");
    const loaderEl = getElementById("tk_loader");
    const timeContainerEl = getElementById("tk_time_container");
    const currentTimeEl = getElementById("tk_current_time");
    const durationEl = getElementById("tk_duration");
    inputEl.onchange = function (e) {
        const file = inputEl.files ? inputEl === null || inputEl === void 0 ? void 0 : inputEl.files[0] : null;
        if (!file || file.type !== "audio/wav") {
            console.error("Error loading file: did not receive a valid .wav file.");
            return;
        }
        console.log("Files: ", file);
        const fileReader = new FileReader();
        fileReader.onerror = function (e) {
            console.error("Error occured reading file: ", fileReader.error);
            return;
        };
        fileReader.onload = function (e) {
            const arrayBuffer = fileReader.result;
            console.log("ArrayBuffer: ", arrayBuffer);
            const view = new DataView(arrayBuffer);
            const durationInSeconds = getWavDurationInSeconds(arrayBuffer);
            console.log(`durationInSeconds=${durationInSeconds}`);
            timeKeeperStateLoaded(loaderEl, timeContainerEl, currentTimeEl, durationEl, { hours: 0, minutes: 0, seconds: 0 }, secondsToDuration(durationInSeconds));
            return;
        };
        fileReader.readAsArrayBuffer(file);
        timeKeeperStateLoading(loaderEl, timeContainerEl);
    };
})();
