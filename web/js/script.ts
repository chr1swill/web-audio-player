// @ts-ignore
const AudioContext = (window.AudioContext || window.webkitAudioContext);

type WaveInfo = {
  nChannels: number,
  sampleRate: number,
  bitsPerSample: number,
  durationInSeconds: number,
}

function getWavInfo(wavBuffer: ArrayBuffer): WaveInfo {
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
  console.log(`chunkId=(${chunkId})`,);

  const chunkIdStr = String.fromCharCode(...chunkId);
  console.log(`chunkIdStr=(${chunkIdStr})`);

  if (chunkIdStr === 'data') {
    cursor += 4 // move to ckSize
    dataChunkSize = dataView.getUint32(cursor, true);
  } else if (chunkIdStr === 'fact') {
    hasFactChunk = true;
    cursor += 4; // move cursor past 'fact' byte

    const LEN = wavBuffer.byteLength - cursor;

    for (; cursor < LEN; cursor++) {
      let maybeChunkId = new Uint8Array(wavBuffer.slice(cursor, cursor + 4), 0, 4);
      if (String.fromCharCode(...maybeChunkId) !== 'data') {
        continue;
      } else {
        cursor += 4; // move to ckSize
        dataChunkSize = dataView.getUint32(cursor, true);
        break;
      }
    }

  } else {
    throw new ReferenceError(`No hanlder for chunk type ${String.fromCharCode(...chunkId)}`);
  }

  const duration = dataChunkSize / (sampleRate * numChannels * (bitsPerSample / 8));

  return {
    nChannels: numChannels,
    sampleRate: sampleRate,
    bitsPerSample: bitsPerSample,
    durationInSeconds: duration,
  }
}

type Duration = {
  hours: number,
  minutes: number,
  seconds: number,
}

function secondsToDuration(seconds: number): Duration {
  if (seconds < 60) {
    return {
      hours: 0,
      minutes: 0,
      seconds: Math.round(seconds),
    }
  } else if (seconds > 59 && seconds < 3599) {
    return {
      hours: 0,
      minutes: Math.floor((seconds / 60) % 60),
      seconds: Math.round(seconds % 60),
    }
  } else {
    return {
      hours: Math.floor(seconds / 60 / 60),
      minutes: Math.floor((seconds / 60) % 60),
      seconds: Math.round(seconds % 60),
    }
  }
}

function formatAsTime(member: number): string {
  return member < 10 ? member.toString().padStart(2, '0') : member.toString();
}

function durationToString(d: Duration): string {
  return (
    `${formatAsTime(d.hours)}:${formatAsTime(d.minutes)}:${formatAsTime(d.seconds)}`
  );
}

function timeKeeperStateLoading(loaderEl: HTMLSpanElement, timeContainerEl: HTMLSpanElement): void {
  timeContainerEl.style.display = "none";
  loaderEl.style.display = "inline";
}

function timeKeeperSetTime(
  currentTimeEl: HTMLParagraphElement,
  durationEl: HTMLParagraphElement,
  currentTime: Duration,
  duration: Duration
): void {
  currentTimeEl.textContent = durationToString(currentTime);
  durationEl.textContent = durationToString(duration);
}

function timeKeeperStateLoaded(
  loaderEl: HTMLSpanElement,
  timeContainerEl: HTMLSpanElement,
  currentTimeEl: HTMLParagraphElement,
  durationEl: HTMLParagraphElement,
  barEl: HTMLInputElement,
  currentTime: Duration,
  duration: number 
): void {
  timeKeeperSetTime(
    currentTimeEl,
    durationEl,
    currentTime,
    secondsToDuration(duration)
  );

  barEl.removeAttribute("disabled");
  barEl.max = String(duration);
  barEl.value = "0";

  loaderEl.style.display = "none";
  timeContainerEl.style.display = "flex";
}

function getElementById(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (el === null) {
    throw new ReferenceError(`Error no element with id: #${id}`);
  } else {
    return el;
  }
}

function setAudioControlsStateReady(playBtn: HTMLButtonElement, pauseBtn: HTMLButtonElement): void {
  playBtn.removeAttribute("disabled");
  pauseBtn.removeAttribute("disabled");
}

function setAudioControlsStateDisabled(playBtn: HTMLButtonElement, pauseBtn: HTMLButtonElement): void {
  playBtn.setAttribute("disabled", "");
  pauseBtn.setAttribute("disabled", "");
}

(function main() {
  const inputEl = getElementById("file_picker") as HTMLInputElement;
  const loaderEl = getElementById("tk_loader") as HTMLSpanElement;
  const timeContainerEl = getElementById("tk_time_container") as HTMLSpanElement;
  const currentTimeEl = getElementById("tk_current_time") as HTMLParagraphElement;
  const durationEl = getElementById("tk_duration") as HTMLParagraphElement;
  const barEl = getElementById("tk_bar") as HTMLInputElement;
  const playBtn = getElementById("ac_play") as HTMLButtonElement;
  const pauseBtn = getElementById("ac_pause") as HTMLButtonElement;

  let wavInfo: WaveInfo; 

  let audioContext: AudioContext;
  let audioBuffer: AudioBuffer;
  let audioArrayBuffer: ArrayBuffer;
  let audioFile: File;
  let sourceNode: AudioBufferSourceNode;

  let isPlaying: boolean = false;
  let currentOffset: number = 0;
  let startTime: number = 0;

  barEl.onchange = function(e: Event): void {
    e.preventDefault();
    if(barEl.hasAttribute("disabled")) {
      return;
    } else {
      // change audio stuff we are playing
      // TODO: investigate this formula and how it can be used to update the bar type efficently
      //
      // Byte Offset = Time in seconds * Sample Rate * Number of Channels * (Bits per Sample / 8)
      //
      // The byte offset is from the data chunk so the address of the data chunk for a file should
      // be stored in a way the would not require searching for it everytime you want update this value
      currentTimeEl.textContent = durationToString(secondsToDuration(parseInt(barEl.value)));
    }
  }

  inputEl.onchange = function(e: Event): void {
    setAudioControlsStateDisabled(playBtn, pauseBtn);
    timeKeeperStateLoading(loaderEl, timeContainerEl);
    console.log("input change event fired");

    if (!(inputEl.files) ||
        inputEl.files[0] === null || 
        (inputEl.files[0].type !== "audio/wav" && 
        inputEl.files[0].type !== "audio/x-wav")
       ) {
         console.error("loading file: did not receive a valid .wav file.");
         console.log(`inputEl.files=(${inputEl.files})`);
         console.log(`inputEl.files[0]=(${!inputEl.files || inputEl.files[0] === null ? null : inputEl.files[0]})`);
         console.log(`inputEl.files[0].type=(${!inputEl.files || !inputEl.files[0] || !inputEl.files[0].type ? null : inputEl.files[0].type})`);
      return;
    } else {
      audioFile = inputEl.files[0];
      console.log("audioFile: ", audioFile);
    }

    audioContext = new AudioContext();
    console.log("audioContext: ", audioContext);

    const fileReader: FileReader = new FileReader();

    fileReader.onerror = function(e: Event): void {
      console.error("occured reading file: ", fileReader!.error);
      return;
    }

    fileReader.onload = function(e: Event): void {
      if (!fileReader.result) {
        console.error("There was not property 'result' on fileReader obj: ", fileReader);
        return;
      }

      console.log("before we create the array buffer in fileReader.onload");
      audioArrayBuffer = fileReader.result as ArrayBuffer;
      console.log("audioArrayBuffer: ", audioArrayBuffer);

      wavInfo = getWavInfo(audioArrayBuffer);

      timeKeeperStateLoaded(
        loaderEl,
        timeContainerEl,
        currentTimeEl,
        durationEl,
        barEl,
        { hours: 0, minutes: 0, seconds: 0},
        wavInfo.durationInSeconds
      );

      setAudioControlsStateReady(playBtn, pauseBtn);
      return;
    }

    fileReader.readAsArrayBuffer(audioFile);
  };

  playBtn.onclick = function(e: Event): void {
    if (isPlaying === true) {
      console.log("Already playing");
      return;
    }
    isPlaying = true;

    audioContext = new AudioContext({ sampleRate: wavInfo.sampleRate });
    const slice = new Float32Array(audioArrayBuffer.slice(0));

    console.log("wavInfo.nChannels: ", wavInfo.nChannels);
    audioBuffer = audioContext.createBuffer(wavInfo.nChannels, slice.length, wavInfo.sampleRate); 
    audioBuffer.getChannelData(0).set(slice);
    console.log("audioBuffer: ", audioBuffer);
    console.log("audioBuffer.duration: ", audioBuffer.duration);

    sourceNode =  audioContext.createBufferSource();
    console.log("audioContext.destination: ", audioContext.destination); 
    sourceNode.buffer = audioBuffer;
    sourceNode.connect(audioContext.destination);
    sourceNode.onended = function(e: Event): void {
      isPlaying = false;
      console.log("audio should have ended");
      return;
    }

    sourceNode.start(0);
    console.log("audio should be playing");
  }

  pauseBtn.onclick = function(e: Event): void {}
})();
