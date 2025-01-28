package main

import (
  "log"
  "net/http"
  "path"
  "io/ioutil"
)

const (
  PORT = ":8082"
)

func main() {
  mux := http.NewServeMux();

  mux.HandleFunc("/styles.css/", func(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodGet {
      log.Printf("Error: Method not allowed\n");
      http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed);
      return;
    }

    fileContent, err := ioutil.ReadFile(path.Join(".", "web", "css", "styles.css"))
    if err != nil {
      http.Error(w, "Unable to read css content", http.StatusInternalServerError);
      return;
    }

    w.Header().Set("Content-Type", "text/css");
    _, err = w.Write(fileContent)
    if err != nil {
      http.Error(w, "Unable to write response", http.StatusInternalServerError);
      return;
    }
  })

  mux.HandleFunc("/script.js/", func(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodGet {
      log.Printf("Error: Method not allowed\n");
      http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed);
      return;
    }

    fileContent, err := ioutil.ReadFile(path.Join(".", "web", "js", "script.js"))
    if err != nil {
      http.Error(w, "Unable to read js content", http.StatusInternalServerError);
      return;
    }

    w.Header().Set("Content-Type", "application/javascript");
    _, err = w.Write(fileContent)
    if err != nil {
      http.Error(w, "Unable to write response", http.StatusInternalServerError);
      return;
    }
  })

  mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodGet {
      log.Printf("Error: Method not allowed\n");
      http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed);
      return;
    }

    fileContent, err := ioutil.ReadFile(path.Join(".", "web", "index.html"))
    if err != nil {
      http.Error(w, "Unable to read html content", http.StatusInternalServerError);
      return;
    }

    w.Header().Set("Content-Type", "text/html");
    _, err = w.Write(fileContent)
    if err != nil {
      http.Error(w, "Unable to write response", http.StatusInternalServerError);
      return;
    }
  })

  log.Printf("Server listening on port %s\n", PORT);
  if err := http.ListenAndServe(PORT, mux); err != nil {
    log.Fatal(err);
    return
  }
}
