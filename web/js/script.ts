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
  constructor() { }

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

  constructor() { 
    TimeKeeper.scrollBar.oninput = function(e: Event): void {
      if (AudioPlayer.playing()) {
        AudioPlayer.pause();
        const tm = setTimeout(function() {
          clearTimeout(tm);
          AudioPlayer.play();
        }, 1000);
      } else {
        TimeKeeper.currentTimeSync();
      }
    }
  }

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
    return parseInt(TimeKeeper.scrollBar.value.trim() === "" ? "0" : TimeKeeper.scrollBar.value.trim());
  }

  static setCurrentTime(currentTime: number) {
    TimeKeeper.scrollBar.value = String(currentTime);
    TimeKeeper.currentTimeEl.textContent = DurationManager.format(DurationManager.new(currentTime));
  }

  static currentTimeSync(): void {
    TimeKeeper.currentTimeEl.textContent = 
      DurationManager.format(
        DurationManager.new(
          parseInt(
            TimeKeeper.scrollBar.value.trim() === "" ? "0" : TimeKeeper.scrollBar.value.trim()
          )
        )
    );
  }

  static incrementCurrentTime() {
    const n = parseFloat(TimeKeeper.scrollBar.value) + 1;
    TimeKeeper.scrollBar.value = String(n);
    TimeKeeper.currentTimeEl.textContent = DurationManager.format(DurationManager.new(n));
  }
}

type AsyncSourceNode = {
  source: AudioBufferSourceNode,
  audioDuration: number,
  resolve: (value?: unknown) => void,
}

function makeAsyncSourceNode(
  source: AudioBufferSourceNode,
  audioDuration: number,
  resolve: (value?: unknown) => void
): AsyncSourceNode {
  return { source: source, audioDuration: audioDuration, resolve: resolve };
}

class ChunkedAudioPlayer {
  private queue: AsyncSourceNode[] = []
  private capacity: Readonly<number>;
  private lastSourceEndTime = 0;

  constructor(capacity: number) {
    this.capacity = capacity;
  }

  /**
   * @param {AsyncSourceNode} node - should not have start called but have a buffer set
   */
  public async addSource(node: AsyncSourceNode): Promise<void> {
    console.log("this.queue.length=",this.queue.length);

    while (this.queue.length >= this.capacity) {
      console.log("I AM BLOCKING");
      await new Promise((resolve) => {
        node.resolve = resolve;
        this.queue.push(node);
      });
    }

    node.source.onended = (e: Event) => {
      TimeKeeper.incrementCurrentTime();
      if (this.queue.length > 0) {
        const item = this.queue.shift();
        if (item != undefined && item.resolve) item.resolve();
      }
    }

    node.source.start(this.lastSourceEndTime)
    this.lastSourceEndTime += node.audioDuration;

    this.queue.push(node);
    console.log("this.queue.length=",this.queue.length);
  }

  public reset(): void {
    for (let i = 0; i < this.queue.length; i++) {
      this.queue[i].source.onended = null;
      this.queue[i].source.disconnect();
    }

    this.queue = [];
    this.lastSourceEndTime = 0;
  }
}

class AudioPlayer {
  private fileInput = getElementById("file_picker") as HTMLInputElement;

  private static playBtn = getElementById("ac_play") as HTMLButtonElement;
  private static pauseBtn = getElementById("ac_pause") as HTMLButtonElement;

  private static isPlaying = false;

  public static playing(): boolean {
    return AudioPlayer.isPlaying;
  }

  private static audioFile: File;
  private static audioCtx: AudioContext;

  private static cap: ChunkedAudioPlayer = new ChunkedAudioPlayer(10);

  private wavInfo: WavInfo | null = null;

  constructor() {
    const self = this;

    self.fileInput.onchange = function(e: Event): void {
      AudioPlayer.btnStateReady();
      TimeKeeper.loadingState();

      if (self.fileInput!.files === null ||
        self.fileInput!.files[0] === null ||
        self.fileInput!.files[0].type !== "audio/wav" &&
        self.fileInput!.files[0].type !== "audio/x-wav"
      ) {
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

    AudioPlayer.playBtn.onclick = async function(e: Event): Promise<void> {
      if (AudioPlayer.isPlaying === true) {
        console.log("self.playBtn click event fired while audio isPlaying === true");
        return;
      }

      if (!self.wavInfo) {
        console.error("self.wavInfo does not exist");
        AudioPlayer.isPlaying = false;
        return;
      }
      AudioPlayer.isPlaying = true;
      console.log("AudioPlayer.isPlaying = true");

      AudioPlayer.audioCtx = new AudioContext({ sampleRate: self.wavInfo.sampleRate });
      const startTime = TimeKeeper.getCurrentTime();

      for (let i = 0; i < (self.wavInfo.durationInSeconds - startTime)/*10*/; i++) {
        await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = function(e: Event): void {
            console.error("reading audio file data to play sound: ", reader.error);
            AudioPlayer.isPlaying = false;
            return;
          }
          reader.onload = async function(e: Event): Promise<void> {
            if (!self.wavInfo) {
              console.error("self.wavInfo does not exist");
              AudioPlayer.isPlaying = false;
              return;
            }

            const slice = new Float32Array(reader.result as ArrayBuffer);

            const audioBuffer = AudioPlayer.audioCtx.createBuffer(self.wavInfo.nChannels, slice.length, self.wavInfo.sampleRate);
            audioBuffer.getChannelData(0).set(slice);

            const source = AudioPlayer.audioCtx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(AudioPlayer.audioCtx.destination);

            console.log("iteration=", i);
            await AudioPlayer.cap.addSource({ source: source, audioDuration: audioBuffer.duration, resolve: resolve });

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

          if (!self.wavInfo) {
            console.error("wave info was null");
            reject();
            return;
          }

          const ONE_SECOND_CHUNK_SIZE = self.wavInfo.sampleRate * self.wavInfo.nChannels * (self.wavInfo.bitsPerSample / 8);
          const chunkByteOffset = currentTime * ONE_SECOND_CHUNK_SIZE;

          const start = self.wavInfo.idxOfDataChunkStart + chunkByteOffset;
          const end = start + ONE_SECOND_CHUNK_SIZE;
          console.log("startIdx=", start);
          console.log("endIdx=", end);
          console.log("difference=", end - start);
          console.log("difference%4=", (end - start) % 4);
          const fileSlice = AudioPlayer.audioFile.slice(start, end);

          reader.readAsArrayBuffer(fileSlice);
          console.log("reader.readAsArrayBuffer(fileSlice)");
        });
      } 
    }

    AudioPlayer.pauseBtn.onclick = function(e: Event): void {
      if (AudioPlayer.isPlaying === false) {
        console.log("audio is not playing, cannot pause it.");
        return;
      }
      AudioPlayer.isPlaying = false;

      AudioPlayer.cap.reset()
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

  public static play(): void {
    AudioPlayer.playBtn.click();
  }

  public static pause(): void {
    AudioPlayer.pauseBtn.click();
  }
}

(function main() {
  const ap = new AudioPlayer();
  const tk = new TimeKeeper();
})();
