try {
  (function FileInput() {
    const inputEl = document.getElementById("file_picker");
    const audioEl = document.getElementById("audio");

    if (inputEl === null) {
      throw new ReferenceError(
        "Error no element with id: #file_picker");
    }

    if (audioEl === null) {
      throw new ReferenceError(
        "Error no element with id: #audio");
    }

    inputEl.addEventListener("change", async function(e) {
      await processFile(e);
    });

    /**@returns{Promise<string | null>}*/
    async function calculateChecksum(file) {
      const start = Date.now();
      const reader = new FileReader();
      console.log("start: ", start);
      console.log("file inside checksum func: ", file);

      return new Promise(function(resolve, reject) {
        reader.onload = function(e) {
          const arrayBuffer = e.target.result;

          crypto.subtle.digest('SHA-1', arrayBuffer).then(function(hashBuffer) {

            console.log("hashBuffer: ", hashBuffer);
            const end = Date.now();
            console.log("end: ", end);
            console.log("time to make hashbuff: ", (end - start));

            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const checksum = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            resolve(checksum);
          }).catch(function(err) {
            console.error("Error crypto.subtle.digest: ", err);
            reject(null);
          });
        };

        reader.onerror = function(e) {
          console.error("Error occured reading file to array buffer: ", e.target.error);
          reject(null);
        };

        reader.readAsArrayBuffer(file);
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

    function debounceStoreCurrentTime(storageKey, mediaElement) {
      let tm = null;
      const DEBOUNCE_DURATION = 5000;

      function storeCurrentTime(storageKey, mediaElement) {
        const time = mediaElement.currentTime;
        console.log("storing currentTime: ", time);
        localStorage.setItem(storageKey, time.toString());
      }

      function debounce() {
        if (tm) clearTimeout(tm);

        if (mediaElement.paused === false) {
          storeCurrentTime(storageKey, mediaElement);
          tm = setTimeout(debounce, DEBOUNCE_DURATION);
        }
      }

      mediaElement.onplay = function() {
        debounce();
      }
      mediaElement.onpause = function() {
        if (tm) clearTimeout(tm);
        storeCurrentTime(storageKey, mediaElement);
      }
      mediaElement.onended = function() {
        if (tm) clearTimeout(tm);
        storeCurrentTime(storageKey, mediaElement);
      }
      window.onvisibilitychange = function() {
        storeCurrentTime(storageKey, mediaElement);
      }
    }

    function copyFile(file) {
      return new File([file], file.name, { type: file.type });
    }

    /**
     * @param{Event}
     * @retuns{void}
     */
    async function processFile(event) {
      const file = event.target.files[0];
      if (!file || !(file.type = "audio/wav")) {
        console.error("Error loading file: please provide a valid .wav file.");
        return;
      }
      console.log("file: ", file);

      Promise.all([calculateChecksum(copyFile(file)),
      makeObjUrl(copyFile(file))]).then(function(results) {
        const [checksum, objUrl] = results;
        console.log("checksum: ", checksum);
        console.log("objUrl: ", objUrl);

        const storageKey = makeStorageKey(file.name, results[0]);
        console.log("storageKey: ", storageKey);
        console.log("audioEl.currentTime: ", audioEl.currentTime);

        audioEl.src = objUrl;

        const currentTime = localStorage.getItem(storageKey);
        if (currentTime !== null) {
          audioEl.currentTime = parseFloat(currentTime);
        }

        debounceStoreCurrentTime(storageKey, audioEl);
        console.log("ready to play audio");
        return;
      }).catch(function(error) {
        console.error(error);
        return;
      });
    }
  })();
} catch (e) {
  console.error("Error occured: ", e);
}
