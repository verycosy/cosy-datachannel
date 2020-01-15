"use strict";

const socket = io();

const dropbox = document.getElementById("dropbox");
const fileList = document.getElementById("fileList");
const connectBtn = document.getElementById("connect");
const disconnectBtn = document.getElementById("disconnect");

const channelStateLabel = document.getElementById("channelState");

let pc = null,
  channel = null;

const pcConfig = {};

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

function handleChannelState(evt) {
  console.log(evt);

  const state = evt.type;
  channelStateLabel.textContent = state;

  if (state === "open") {
    connectBtn.disabled = true;
    disconnectBtn.disabled = false;
  } else {
    if (state === "close") disconnect();
    else {
      connectBtn.disabled = false;
      disconnectBtn.disabled = true;
    }
  }
}

async function connect() {
  if (!pc) makePeerConnection();

  channel = pc.createDataChannel("cosy-datachannel");
  channel.addEventListener("open", handleChannelState);
  channel.addEventListener("close", handleChannelState);

  try {
    const desc = await pc.createOffer();
    pc.setLocalDescription(desc);
    socket.emit("offer", desc);
  } catch (err) {
    console.error(err);
  }

  console.log(channel);
}

function disconnect() {
  if (channel) channel.close();
  if (pc) pc.close();

  channel = null;
  pc = null;

  connectBtn.disabled = false;
  disconnectBtn.disabled = true;

  console.log("disconnected");
}

function makePeerConnection() {
  pc = new RTCPeerConnection(pcConfig);

  pc.addEventListener("icecandidate", evt => {
    if (evt.candidate) socket.emit("icecandidate", evt.candidate);
  });
  pc.addEventListener("connectionstatechange", evt => console.log(evt));
}

(function init() {
  makePeerConnection();

  connectBtn.addEventListener("click", connect);
  disconnectBtn.addEventListener("click", disconnect);

  dropbox.addEventListener("dragover", handleFileDrag);
  dropbox.addEventListener("drop", handleFileSelect);

  document.getElementById("files").addEventListener("change", handleFileSelect);

  socket.on("offer", async offerSDP => {
    if (!pc) makePeerConnection();

    try {
      await pc.setRemoteDescription(offerSDP);

      const answerSDP = await pc.createAnswer();
      pc.setLocalDescription(answerSDP);
      pc.addEventListener("datachannel", evt => {
        channel = evt.channel;

        channel.addEventListener("open", handleChannelState);
        channel.addEventListener("close", handleChannelState);
      });

      socket.emit("answer", answerSDP);
    } catch (err) {
      console.error(err);
    }
  });

  socket.on("answer", async answerSDP => {
    try {
      await pc.setRemoteDescription(answerSDP);
    } catch (err) {
      console.error(err);
    }
  });

  socket.on("icecandidate", candidate => {
    if (pc) pc.addIceCandidate(new RTCIceCandidate(candidate));
  });
})();
