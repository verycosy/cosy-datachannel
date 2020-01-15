const socket = io();

const fileList = document.getElementById("fileList");

//FIXME: Directoy Not Supported Yet
function handleFileSelect(evt) {
  evt.preventDefault();

  const files = evt.target.files || evt.dataTransfer.files;
  addFilesToList(files);
}

function addFilesToList(files) {
  fileList.innerHTML = "";

  for (let i = 0; i < files.length; i++) {
    const li = document.createElement("li");
    li.textContent = files[i].name;
    fileList.appendChild(li);
  }
}

function handleFileDrag(evt) {
  evt.preventDefault();

  evt.dataTransfer.dropEffect = "copy";
}

(function init() {
  const dropbox = document.getElementById("dropbox");
  dropbox.addEventListener("dragover", handleFileDrag);
  dropbox.addEventListener("drop", handleFileSelect);

  document.getElementById("files").addEventListener("change", handleFileSelect);
})();
