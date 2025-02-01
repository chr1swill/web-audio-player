// @ts-ignore
const AudioContext = (window.AudioContext || window.webkitAudioContext);

type WavInfo = {
  nChannels: number,
  sampleRate: number,
  bitsPerSample: number,
  durationInSeconds: number,
  dataChunkSize: number,
  idxOfDataChunkStart: number,
}

function getWavInfo(wavBuffer: ArrayBuffer): WavInfo {
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
    dataChunkSize: dataChunkSize,
    idxOfDataChunkStart: cursor - 4,
  }
}

function getElementById(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (el === null) {
    throw new ReferenceError(`Error no element with id: #${id}`);
  } else {
    return el;
  }
}

type Duration = {
  hours: number,
  minutes: number,
  seconds: number,
}

class DurationManager {
  constructor() {}

  private static formatAsTime(member: number): string {
    return member < 10 ? member.toString().padStart(2, '0') : member.toString();
  }

  static new(seconds?: number): Duration {
    if (seconds === undefined) {
      return { hours: 0, minutes: 0, seconds: 0 };
    }

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

  static format(d: Duration): string {
    return (
      `${DurationManager.formatAsTime(d.hours)
      }:${DurationManager.formatAsTime(d.minutes)
      }:${DurationManager.formatAsTime(d.seconds)
      }`
    );
  }
}

class TimeKeeper {
  private static loaderEl = getElementById("tk_loader") as HTMLSpanElement;
  private static timeContainerEl = getElementById("tk_time_container") as HTMLSpanElement;
  private static currentTimeEl = getElementById("tk_current_time") as HTMLParagraphElement;
  private static durationEl = getElementById("tk_duration") as HTMLParagraphElement;
  private static scrollBar = getElementById("tk_bar") as HTMLInputElement;

  constructor() {}

  static loadingState(): void {
    TimeKeeper.scrollBar.setAttribute("disabled", "");

    TimeKeeper.timeContainerEl.style.display = "none";
    TimeKeeper.loaderEl.style.display = "inline";
  }

  static readyState(): void {
    TimeKeeper.loaderEl.style.display = "none";
    TimeKeeper.timeContainerEl.style.display = "flex";
  }

  static setTime(currentTime: number, durationInSeconds: number) {
    if (TimeKeeper.scrollBar.hasAttribute("disabled")) {
      TimeKeeper.scrollBar.removeAttribute("disabled");
    }

    TimeKeeper.scrollBar.max = String(durationInSeconds);
    TimeKeeper.scrollBar.value = String(currentTime);

    TimeKeeper.currentTimeEl.textContent = DurationManager.format(DurationManager.new(currentTime));
    TimeKeeper.durationEl.textContent = DurationManager.format(DurationManager.new(durationInSeconds));
  }

  static getCurrentTime(): number {
    return parseInt(TimeKeeper.scrollBar.value.trim() === "" ? "0" :  TimeKeeper.scrollBar.value.trim());
  }

  static setCurrentTime(currentTime: number) {
    TimeKeeper.scrollBar.value = String(currentTime);
    TimeKeeper.currentTimeEl.textContent = DurationManager.format(DurationManager.new(currentTime));;
  }

  static incrementCurrentTime() {
    const n = parseFloat(TimeKeeper.scrollBar.value) + 1;
    TimeKeeper.scrollBar.value = String(n);
    TimeKeeper.currentTimeEl.textContent = DurationManager.format(DurationManager.new(n));
  }
}

class ChunkedAudioPlayer {
  private sources: AudioBufferSourceNode[] = []
  private capacity: Readonly<number>;
  private length: number = 0;
  private lastSourceEndTime = 0;

  constructor(capacity: number) {
    this.capacity = capacity;
  }

  /**
   * @param {AudioBufferSourceNode} source - should not have start called but have a buffer set
   * @param {number} audioDuration - the duaration of the audioBuffer the source holds
   */
  public addSource(source: AudioBufferSourceNode, audioDuration: number): void {
    if (this.length === this.capacity) {
      console.error("cannot add another source, capacity was hit: ", this.capacity);
      return;
    }

    source.onended = (e: Event) => {
      TimeKeeper.incrementCurrentTime();
      this.sources.splice(this.sources.indexOf(source), 1);
      this.length--;
    }

    source.start(this.lastSourceEndTime)
    this.lastSourceEndTime += audioDuration;

    this.sources.push(source)
    this.length++;
  }

  public reset(): void {
    for (let i = 0; i < this.sources.length; i++) {
      this.sources[i].onended = null;
      this.sources[i].disconnect();
    }

    this.sources = [];
    this.length = 0;
    this.lastSourceEndTime = 0;
  }
}

class AudioPlayer {
  private fileInput = getElementById("file_picker") as HTMLInputElement;

  private static playBtn = getElementById("ac_play") as HTMLButtonElement;
  private static pauseBtn = getElementById("ac_pause") as HTMLButtonElement;

  private isPlaying = false;

  private static audioFile: File;
  private static audioCtx: AudioContext;

  private static cap: ChunkedAudioPlayer = new ChunkedAudioPlayer(10);

  private wavInfo: WavInfo | null = null;

  constructor(){
    const self = this;

    self.fileInput.onchange = function(e: Event): void {
      AudioPlayer.btnStateReady();
      TimeKeeper.loadingState();

      if(self.fileInput!.files === null ||
         self.fileInput!.files[0] === null ||
           self.fileInput!.files[0].type !== "audio/wav" && 
             self.fileInput!.files[0].type !== "audio/x-wav") {
        console.error("loading file: did not receive a valid .wav file.");
      console.log(`self.fileInput.files=(${self.fileInput.files})`);
      console.log(
        `self.fileInput.files[0]=(${!self.fileInput.files ||
                                  self.fileInput.files[0] === null ? null :
                                  self.fileInput.files[0]})`
      );
      console.log(
        `self.fileInput.files[0].type=(${!self.fileInput.files ||
                                       !self.fileInput.files[0] ||
                                       !self.fileInput.files[0].type ? null :
                                       self.fileInput.files[0].type})`
      );
      return;
      }

      AudioPlayer.audioFile = self.fileInput.files[0];
      console.log("ChunkedAudioPlayer.audioFile: ", AudioPlayer.audioFile);

      const slice = AudioPlayer.audioFile.slice(0, 256);
      const reader = new FileReader();

      reader.onerror = function(e: Event): void {
        console.error("reading slice of file to get wav info: ", reader.error);
        return;
      }

      reader.onload = function(e: Event): void {
        self.wavInfo = getWavInfo(reader.result as ArrayBuffer);
        console.log("self.wavInfo: ", self.wavInfo);
        AudioPlayer.btnStateReady();
        TimeKeeper.setTime(0, self.wavInfo.durationInSeconds);
        TimeKeeper.readyState();
      }

      reader.readAsArrayBuffer(slice);
    }

    AudioPlayer.playBtn.onclick = function(e: Event): void {
      if (self.isPlaying === true) {
        console.log("self.playBtn click event fired while audio isPlaying === true");
        return;
      }
      self.playBtnClickHanlder(e, self);
    }

    AudioPlayer.pauseBtn.onclick = function(e: Event): void {
      if (self.isPlaying === false) {
        console.log("audio is not playing, cannot pause it.");
        return;
      }
      self.isPlaying = false;

      AudioPlayer.cap.reset()
    }
  }

  private playBtnClickHanlder(e: Event, self: AudioPlayer): void {
    if (!self.wavInfo) {
      console.error("self.wavInfo does not exist");
      self.isPlaying = false;
      return;
    }
    self.isPlaying = true;
    console.log("self.isPlaying = true"); 

    AudioPlayer.audioCtx = new AudioContext({ sampleRate: self.wavInfo.sampleRate });
    const startTime = TimeKeeper.getCurrentTime();


    for (let i = 0; i < /*(startTime - self.wavInfo.durationInSeconds)*/ 10; i++) {
      const reader = new FileReader();
      reader.onerror = function(e: Event): void {
        console.error("reading audio file data to play sound: ", reader.error);
        self.isPlaying = false;
        return;
      }
      reader.onload = function(e: Event): void {
        if (!self.wavInfo) {
          console.error("self.wavInfo does not exist");
          self.isPlaying = false;
          return;
        }

        const slice = new Float32Array(reader.result as ArrayBuffer);

        const audioBuffer = AudioPlayer.audioCtx.createBuffer(self.wavInfo.nChannels, slice.length, self.wavInfo.sampleRate);
        audioBuffer.getChannelData(0).set(slice);

        const source = AudioPlayer.audioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(AudioPlayer.audioCtx.destination);

        AudioPlayer.cap.addSource(source, audioBuffer.duration);
      }

      // when I don't add the 0.01 seconds there is a weird poping sound the plays before the audio
      // anything less then 0.01 and the audio turns into loud static sounds
      // anything more then audio skips to far forward
      const SECONDS_TO_SKIP_POP_SOUND = 0.01;
      const time = startTime + i;

      let currentTime: number;
      if (time !== 0) {
        currentTime = time; 
      } else {
        currentTime = time + SECONDS_TO_SKIP_POP_SOUND; 
      }

      const ONE_SECOND_CHUNK_SIZE = self.wavInfo.sampleRate * self.wavInfo.nChannels * (self.wavInfo.bitsPerSample / 8);
      const chunkByteOffset = currentTime * ONE_SECOND_CHUNK_SIZE;

      const start = self.wavInfo.idxOfDataChunkStart + chunkByteOffset;
      const end = start + ONE_SECOND_CHUNK_SIZE;
      console.log("startIdx=", start);
      console.log("endIdx=", end);
      console.log("difference=", end - start);
      console.log("difference%4=", (end - start)%4);
      const fileSlice = AudioPlayer.audioFile.slice(start, end); 

      reader.readAsArrayBuffer(fileSlice);
      console.log("reader.readAsArrayBuffer(fileSlice)");
    }
  }

  private static btnStateReady(): void {
    AudioPlayer.playBtn.removeAttribute("disabled");
    AudioPlayer.pauseBtn.removeAttribute("disabled");
  }

  private static btnStateDisabled(): void {
    AudioPlayer.playBtn.setAttribute("disabled", "");
    AudioPlayer.pauseBtn.setAttribute("disabled", "");
  }
}

(function main() {
  //const inputEl = getElementById("file_picker") as HTMLInputElement;
  //const loaderEl = getElementById("tk_loader") as HTMLSpanElement;
  //const timeContainerEl = getElementById("tk_time_container") as HTMLSpanElement;
  //const currentTimeEl = getElementById("tk_current_time") as HTMLParagraphElement;
  //const durationEl = getElementById("tk_duration") as HTMLParagraphElement;
  //const barEl = getElementById("tk_bar") as HTMLInputElement;
  //const playBtn = getElementById("ac_play") as HTMLButtonElement;
  //const pauseBtn = getElementById("ac_pause") as HTMLButtonElement;

  //let wavInfo: WavInfo;

  //let audioContext: AudioContext;
  //let audioBuffer: AudioBuffer;
  //let audioArrayBuffer: ArrayBuffer;
  //let audioFile: File;
  //let sourceNode: AudioBufferSourceNode;

  //let isPlaying: boolean = false;
  //let currentOffset: number = 0;
  //let startTime: number = 0;

  //barEl.onchange = function(e: Event): void {
  //  e.preventDefault();
  //  if (barEl.hasAttribute("disabled")) {
  //    return;
  //  } else {
  //    // change audio stuff we are playing
  //    // TODO: investigate this formula and how it can be used to update the bar type efficently
  //    //
  //    // Byte Offset = Time in seconds * Sample Rate * Number of Channels * (Bits per Sample / 8)
  //    //
  //    // The byte offset is from the data chunk so the address of the data chunk for a file should
  //    // be stored in a way the would not require searching for it everytime you want update this value
  //    currentTimeEl.textContent = durationToString(secondsToDuration(parseInt(barEl.value)));
  //  }
  //}

  //inputEl.onchange = function(e: Event): void {
  //  setAudioControlsStateDisabled(playBtn, pauseBtn);
  //  timeKeeperStateLoading(loaderEl, timeContainerEl);
  //  console.log("input change event fired");

  //  if (!(inputEl.files) ||
  //    inputEl.files[0] === null ||
  //    (inputEl.files[0].type !== "audio/wav" &&
  //      inputEl.files[0].type !== "audio/x-wav")
  //  ) {
  //    console.error("loading file: did not receive a valid .wav file.");
  //    console.log(`inputEl.files=(${inputEl.files})`);
  //    console.log(`inputEl.files[0]=(${!inputEl.files || inputEl.files[0] === null ? null : inputEl.files[0]})`);
  //    console.log(`inputEl.files[0].type=(${!inputEl.files || !inputEl.files[0] || !inputEl.files[0].type ? null : inputEl.files[0].type})`);
  //    return;
  //  } else {
  //    audioFile = inputEl.files[0];
  //    console.log("audioFile: ", audioFile);
  //  }

  //  audioContext = new AudioContext();
  //  console.log("audioContext: ", audioContext);

  //  const fileReader: FileReader = new FileReader();

  //  fileReader.onerror = function(e: Event): void {
  //    console.error("occured reading file: ", fileReader!.error);
  //    return;
  //  }

  //  fileReader.onload = function(e: Event): void {
  //    if (!fileReader.result) {
  //      console.error("There was not property 'result' on fileReader obj: ", fileReader);
  //      return;
  //    }

  //    console.log("before we create the array buffer in fileReader.onload");
  //    audioArrayBuffer = fileReader.result as ArrayBuffer;
  //    console.log("audioArrayBuffer: ", audioArrayBuffer);

  //    wavInfo = getWavInfo(audioArrayBuffer);

  //    timeKeeperStateLoaded(
  //      loaderEl,
  //      timeContainerEl,
  //      currentTimeEl,
  //      durationEl,
  //      barEl,
  //      { hours: 0, minutes: 0, seconds: 0 },
  //      wavInfo.durationInSeconds
  //    );

  //    setAudioControlsStateReady(playBtn, pauseBtn);
  //    return;
  //  }

  //  fileReader.readAsArrayBuffer(audioFile);
  //};

  //playBtn.onclick = function(e: Event): void {
  //  if (isPlaying === true) {
  //    console.log("Already playing");
  //    return;
  //  }
  //  isPlaying = true;

  //  audioContext = new AudioContext({ sampleRate: wavInfo.sampleRate });
  //  const slice = new Float32Array(audioArrayBuffer.slice(0));

  //  console.log("wavInfo.nChannels: ", wavInfo.nChannels);
  //  audioBuffer = audioContext.createBuffer(wavInfo.nChannels, slice.length, wavInfo.sampleRate);
  //  audioBuffer.getChannelData(0).set(slice);
  //  console.log("audioBuffer: ", audioBuffer);
  //  console.log("audioBuffer.duration: ", audioBuffer.duration);

  //  sourceNode = audioContext.createBufferSource();
  //  console.log("audioContext.destination: ", audioContext.destination);
  //  sourceNode.buffer = audioBuffer;
  //  sourceNode.connect(audioContext.destination);
  //  sourceNode.onended = function(e: Event): void {
  //    isPlaying = false;
  //    console.log("audio should have ended");
  //    return;
  //  }

  //  sourceNode.start(0);
  //  console.log("audio should be playing");
  //}

  //pauseBtn.onclick = function(e: Event): void { }
  const ap = new AudioPlayer();
})();
