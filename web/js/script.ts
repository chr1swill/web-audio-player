interface RiffChunk {
  chunkId: Uint8Array;
  //ckSize: Uint32Array;
}

function RiffChunkPrint(rc: RiffChunk): void {
  console.log("rc.chunkId: ", String.fromCharCode(...rc.chunkId));
  //console.log("rc.ckSize: ", ...rc.ckSize);
}

(function main() {
  var inputEl = document.getElementById("file_picker") as HTMLInputElement | null;
  if (inputEl === null) {
    throw new ReferenceError(
      "Error no element with id: #file_picker");
  }

  inputEl.onchange = function(e: Event): void {
    const file: File | null = 
      inputEl !== null && inputEl.files ? inputEl?.files[0] : null;
    if (!file || !(file.type.includes("audio/"))) {
      console.error("Error loading file: please provide a valid .wav file.");
      return;
    }
    console.log("files: ", file);

    var fr: FileReader = new FileReader(); 

    fr.onerror = function(e: Event) {
      console.error("Error occured reading file: ", fr!.error);
      return;
    }
    fr.onload = function(e: Event) {
      const arrayBuffer = fr!.result as ArrayBuffer;
      console.log("ArrayBuffer: ", arrayBuffer);
      //const view: DataView  = new DataView(arrayBuffer);
      //console.log("view: ", view);

      //console.log("view.getInt8(0): ", String.fromCharCode(view.getInt8(0)));
      //console.log("view.getInt8(1): ", String.fromCharCode(view.getInt8(1)));
      //console.log("view.getInt8(3): ", String.fromCharCode(view.getInt8(3))); 
      //console.log("view.getInt8(2): ", String.fromCharCode(view.getInt8(2)));

      const rc: RiffChunk = {
        chunkId: new Uint8Array(arrayBuffer.slice(0,4), 0, 4),
        //ckSize: new Uint32Array(arrayBuffer.slice(5, 9), 0, 1),
      };

      RiffChunkPrint(rc);

      return;
    }

    fr.readAsArrayBuffer(file);
  };
})();
