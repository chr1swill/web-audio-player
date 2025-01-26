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
    return;
  };
})();
