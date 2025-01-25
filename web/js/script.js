try {
  /**@type{HTMLAudioElement | null}*/
  var audioEl = null;

  var inputEl = document.getElementById("file_picker");
  var btnPlayPause = document.getElementById("audio_play_pause");

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

  btnPlayPause.onclick = function(e) {
    e.preventDefault();
    if (audioEl === null) {
      return;
    }

    if (audioEl.paused === true) {
      audioEl.play();
      btnPlayPause.textContent = "||";
    } else {
      audioEl.pause();
      btnPlayPause.textContent = ">";
    }
  }

  function fileChecksum(file) {
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
        const arrayBuffer = event.target.result;
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
        reject(new Error("Error reading file: " + event.target.error.code));
      };

      function readNextChunk() {
        const slice = file.slice(offset, offset + chunkSize);
        reader.readAsArrayBuffer(slice);
      }

      // Start reading the first chunk
      readNextChunk();
    });
  }

  /**@returns {string}*/
  async function makeObjUrl(file) {
    return URL.createObjectURL(file);
  }

  /**@returns {void}*/
  function freeObjUrl(objUrl) {
    URL.revokeObjectURL(objUrl);
  }

  /**@returns{string}*/
  function makeStorageKey(filename, checksum) {
    return filename + "-" + checksum;
  }

  function setupDebounceStoreCurrentTime(storageKey) {
    let tm = null;
    const DEBOUNCE_DURATION = 5000;

    function storeCurrentTime() {
      const time = audioEl.currentTime;
      console.log("storing currentTime: ", time);
      localStorage.setItem(storageKey, time.toString());
    }

    function debounce() {
      if (tm) clearTimeout(tm);

      if (audioEl.paused === false) {
        storeCurrentTime();
        tm = setTimeout(debounce, DEBOUNCE_DURATION);
      }
    }

    audioEl.onplay = function() {
      debounce();
    }
    audioEl.onpause = function() {
      if (tm) clearTimeout(tm);
      storeCurrentTime();
    }
    audioEl.onended = function() {
      if (tm) clearTimeout(tm);
      storeCurrentTime();
    }
    audioEl.ontimeupdate = function() {
      console.log("Current time updated: ", audioEl.currentTime);
    }
    window.onvisibilitychange = function() {
      storeCurrentTime();
    }
  }

  function copyFile(file) {
    return new File([file], file.name, { type: file.type });
  }

  function restoreAudioCurrentTime(storageKey, audioEl) {
    console.log("audioEl.currentTime before: ", audioEl.currentTime);
    const currentTime = localStorage.getItem(storageKey);
    if (currentTime !== null) {

      const _tm = setTimeout(function () {
        clearTimeout(_tm);

        audioEl.currentTime = parseFloat(currentTime);
        console.log("audioEl.currentTime after: ", audioEl.currentTime);

        setupDebounceStoreCurrentTime(storageKey, audioEl);
        console.log("ready to play audio");
      }, 100)
      
    } else {
      console.log("audioEl.currentTime after: ", audioEl.currentTime);

      setupDebounceStoreCurrentTime(storageKey, audioEl);
      console.log("ready to play audio");
    }
  }

  /**
   * @param{string} src
   * @returns{void}
   */
  function audioElInit(src) {
    if (audioEl === null) {
      audioEl = new Audio(src);
      console.log("Created audio element: ", audioEl);
    } else {
      console.log("Audio element is already initialized: ", audioEl);
    }

    console.log("Audio element source: ", audioEl.src);
  }

  /**
   * @param{Event}
   * @retuns{void}
   */
  async function processFile(event) {
    const file = event.target.files[0];
    if (!file || !(file.type === "audio/wav")) {
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

      restoreAudioCurrentTime(storageKey, audioEl);
      console.log("Audio is ready to be played! Starting at time: ", audioEl.currentTime);
      btnPlayPause.removeAttribute("disabled");

    }).catch(function(error) {
      console.error(error);
      return;
    });
  }
} catch (e) {
  console.error("Error occured: ", e);
}
