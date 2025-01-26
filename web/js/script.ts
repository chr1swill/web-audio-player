try {
  var audioEl: HTMLAudioElement | null = null;

  var inputEl: HTMLInputElement = document.getElementById("file_picker") as HTMLInputElement;
  var btnPlayPause: HTMLButtonElement = document.getElementById("audio_play_pause") as HTMLButtonElement;

  if (inputEl === null) {
    throw new ReferenceError(
      "Error no element with id: #file_picker");
  }

  inputEl.onchange = async function(e) {
    await processFile(e);
  };

  if (btnPlayPause === null) {
    throw new ReferenceError(
      "Error no element with id: #audio_play_pause");
  }

  btnPlayPause.setAttribute("disabled", "");

  btnPlayPause.onclick = async function(e) {
    e.preventDefault();
    if (audioEl === null) {
      return;
    }

    if (audioEl!.paused === true) {
      await audioEl!.play();
      btnPlayPause.textContent = "||";
    } else {
      audioEl!.pause();
      btnPlayPause.textContent = ">";
    }
  }

  function fileChecksum(file: File): Promise<string> {
    const start = Date.now();
    return new Promise((resolve, reject) => {
      const totalSegments = 8;
      const segmentSize = Math.ceil(file.size / totalSegments); // Size of each segment
      const chunkSize = 1024 * 1024 * 4; // 4MB chunks
      let checksums = new Array(totalSegments).fill(0); // Initialize checksums array
      let currentSegment = 0;
      let offset = 0;

      const reader = new FileReader();

      reader.onload = function(event) {
        const arrayBuffer = event.target!.result;
        if (!(arrayBuffer instanceof ArrayBuffer)) {
          throw new TypeError(`Error value was not an ArrayBuffer: ${arrayBuffer}`);
        }

        const uint8Array = new Uint8Array(arrayBuffer);

        // Sum the bytes in the current chunk
        for (let i = 0; i < uint8Array.length; i++) {
          if (currentSegment < totalSegments) {
            checksums[currentSegment] += uint8Array[i];
          }
        }

        // Move to the next segment if we have filled the current one
        if (uint8Array.length + offset >= (currentSegment + 1) * segmentSize) {
          currentSegment++;
        }

        offset += uint8Array.length;

        // If there are more bytes to read, read the next chunk
        if (offset < file.size) {
          readNextChunk();
        } else {
          // Convert checksums to hex strings and join them
          const checksumString = checksums.map(sum => (sum % 256).toString(16).padStart(2, '0')).join('');
          const end = Date.now();
          console.log("Checksum completed in:", (end - start), "ms");
          resolve(checksumString);
        }
      };

      reader.onerror = function(event) {
        reject(new Error("Error reading file: " + event.target!.error));
      };

      function readNextChunk() {
        const slice = file.slice(offset, offset + chunkSize);
        reader.readAsArrayBuffer(slice);
      }

      // Start reading the first chunk
      readNextChunk();
    });
  }

  async function makeObjUrl(file: File): Promise<string> {
    return URL.createObjectURL(file);
  }

  function freeObjUrl(objUrl: string): void {
    URL.revokeObjectURL(objUrl);
  }

  function makeStorageKey(filename: string, checksum: string): string {
    return filename + "-" + checksum;
  }

  function setupDebounceStoreCurrentTime(storageKey: string): void {
    let tm: number = -1;
    const DEBOUNCE_DURATION = 5000;

    function storeCurrentTime() {
      const time = audioEl!.currentTime;
      console.log("storing currentTime: ", time);
      localStorage.setItem(storageKey, time.toString());
    }

    function debounce() {
      if (tm !== -1) clearTimeout(tm);

      if (audioEl!.paused === false) {
        storeCurrentTime();
        tm = setTimeout(debounce, DEBOUNCE_DURATION);
      }
    }

    audioEl!.onplay = function() {
      debounce();
    }
    audioEl!.onpause = function() {
      if (tm !== -1) clearTimeout(tm);
      storeCurrentTime();
    }
    audioEl!.onended = function() {
      if (tm !== -1) clearTimeout(tm);
      storeCurrentTime();
    }
    audioEl!.ontimeupdate = function() {
      console.log("Current time updated: ", audioEl!.currentTime);
    }
    //@ts-ignore
    window.onvisibilitychange = function() {
      storeCurrentTime();
    }
  }

  function copyFile(file: File): File {
    return new File([file], file.name, { type: file.type });
  }

  function restoreAudioCurrentTime(storageKey: string): void {
    console.log("audioEl!.currentTime before: ", audioEl!.currentTime);
    const currentTime = localStorage.getItem(storageKey);
    console.log("currentTime pulled out of storage: ", currentTime);
    if (currentTime !== null) {
      try {
        audioEl!.fastSeek(parseInt(currentTime));
      } catch (e) {
        console.error("Error fastSeek: ", e);
        console.warn("Using fallback, explictly setting HTMLAudioElement.currentTime property");
        audioEl!.currentTime = parseFloat(currentTime);
      }
      console.log("audioEl!.currentTime after: ", audioEl!.currentTime);
    } 

    setupDebounceStoreCurrentTime(storageKey);
    console.log("ready to play audio");
  }

  /**
   * @param{string} src
   * @returns{void}
   */
  function audioElInit(src: string): void {
    if (audioEl === null) {
      audioEl = new Audio(src);
      console.log("Created audio element: ", audioEl);
    } else {
      console.log("Audio element is already initialized: ", audioEl);
    }

    console.log("Audio element source: ", audioEl!.src);
  }

  async function processFile(event: Event) {
    // @ts-ignore
    const file: File = event.target!.files[0];
    if (!file || !(file.type.includes("audio/"))) {
      console.error("Error loading file: please provide a valid .wav file.");
      return;
    }
    console.log("file: ", file);

    Promise.all([fileChecksum(copyFile(file)),
    makeObjUrl(copyFile(file))]).then(function(results) {
      const [checksum, objUrl] = results;
      console.log("checksum: ", checksum);

      const storageKey = makeStorageKey(file.name, checksum);
      console.log("storageKey: ", storageKey);

      audioElInit(objUrl);

      restoreAudioCurrentTime(storageKey);
      console.log("Audio is ready to be played! Starting at time: ", audioEl?.currentTime);
      btnPlayPause!.removeAttribute("disabled");

    }).catch(function(error) {
      console.error(error);
      return;
    });
  }
} catch (e) {
  console.error("Error occured: ", e);
}
