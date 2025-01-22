(function FileInput() {
  let inputEl;
  let audioEl;

  if ((inputEl = document.getElementById("file_picker")) === null) {
    throw new ReferenceError(
      "Error no element with id: #file_picker"); 
  }

  if ((audioEl = document.getElementById("audio")) === null) {
    throw new ReferenceError(
      "Error no element with id: #audio"); 
  }

  inputEl.addEventListener("change",
    loadFile);


  /**@param{Event}*/
  function loadFile(event) {
    let file;
    let fileUrl;

    file = event.target.files[0];
    if (!file || !(file.type = "audio/wav")) {
      console.error("Error loading file: please provide a valid .wav file.");
      return;
    }

    fileUrl = URL.createObjectURL(file);
    audioEl.src = fileUrl;

    audioEl.play.then(function() {
      console.log("Audio is playing I think.?!");
      URL.revokeObjectURL(fileUrl);
    }).catch(function(err) {
      console.error("Error: ", err);
    });
  }

  // TODO: keep track of the currentTime in local storage peridcally 
  // then when you open up the same file name again you can set currentTime
  // to be value saved in localStorage
  // effectivey saving the state of the audio book for the next time you listen
})();
