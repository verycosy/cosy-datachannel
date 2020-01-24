"use strict";

const socket = io();

const dropbox = document.getElementById("dropbox");
const sentList = document.getElementById("sentList");
const connectBtn = document.getElementById("connect");
const disconnectBtn = document.getElementById("disconnect");
const chatList = document.getElementById("chatList");
const chat = document.getElementById("chat");

const channelStateLabel = document.getElementById("channelState");

let pc = null,
  channel = null;

const pcConfig = {};
const MB = 1024 * 1024;
const bodyColor = `white`;
const progressColor = `#f8ce5b`;

//FIXME: Directoy Not Supported Yet
function handleFileSelect(evt) {
  evt.preventDefault();

  const files = evt.target.files || evt.dataTransfer.files;
  addFilesToList(files);
}

function prettySize(bytes, separator = "", postFix = "") {
  if (bytes) {
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.min(
      parseInt(Math.floor(Math.log(bytes) / Math.log(1024)), 10),
      sizes.length - 1
    );
    return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)}${separator}${
      sizes[i]
    }${postFix}`;
  }
  return "n/a";
}

function makeProgressBar(li) {
  return evt => {
    console.log(evt);
    if (evt.lengthComputable) {
      const percentage = Math.round((evt.loaded / evt.total) * 100);
      console.log(evt.loaded + " / " + evt.total);

      li.style.backgroundImage = `linear-gradient(to right, ${progressColor} ${percentage}%, ${bodyColor} ${100 -
        percentage}%)`;
    }
  };
}

function addFilesToList(files) {
  sentList.innerHTML = "";

  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    const li = document.createElement("li");
    if (file.type.match("image/*")) {
      const reader = new FileReader();

      reader.onload = evt => {
        const img = document.createElement("img");
        img.src = evt.target.result;
        li.append(img);
        sentList.appendChild(li);
      };
      reader.readAsDataURL(file);

      //const blob = file.slice(start,stop)
      // case by case error handling, abort
    } else {
      const reader = new FileReader();
      reader.onprogress = makeProgressBar(li);
      reader.readAsDataURL(file);
      li.textContent = `${file.name} + (${prettySize(file.size)})`;
      sentList.appendChild(li);
    }
  }
}

function handleFileDrag(evt) {
  evt.preventDefault();

  evt.dataTransfer.dropEffect = "copy";
}

function handleChannelState(evt) {
  console.log(evt);

  const state = evt.type;
  // or channel.readyState
  channelStateLabel.textContent = state;

  if (state === "open") {
    connectBtn.disabled = true;
    disconnectBtn.disabled = false;
    chat.disabled = false;
  } else {
    if (state === "close") disconnect();
    else {
      connectBtn.disabled = false;
      disconnectBtn.disabled = true;
      chat.disabled = true;
    }
  }
}

function handleChannelMessage(evt) {
  console.log(evt);
  attachChat(evt.data, 1);
}

function addEventToChannel(channel) {
  channel.addEventListener("open", handleChannelState);
  channel.addEventListener("close", handleChannelState);
  channel.addEventListener("message", handleChannelMessage);
}

async function connect() {
  if (!pc) makePeerConnection();

  channel = pc.createDataChannel("cosy-datachannel");
  addEventToChannel(channel);

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
  chat.disabled = true;

  console.log("disconnected");
}

function makePeerConnection() {
  pc = new RTCPeerConnection(pcConfig);

  pc.addEventListener("icecandidate", evt => {
    if (evt.candidate) socket.emit("icecandidate", evt.candidate);
  });
  pc.addEventListener("connectionstatechange", evt => console.log(evt));
}

function attachChat(text, type) {
  const li = document.createElement("li");
  li.textContent = text;
  li.className = type === 0 ? "from" : "to";
  chatList.appendChild(li);
}

function sendMessage(evt) {
  if (evt.key === "Enter") {
    channel.send(evt.target.value);
    attachChat(evt.target.value, 0);
    chat.value = "";
  }
}

(function init() {
  makePeerConnection();

  chat.addEventListener("keypress", sendMessage);
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
        addEventToChannel(channel);
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
    if (pc) {
      pc.addIceCandidate(new RTCIceCandidate(candidate))
        .then(res => console.log("I have a Candidate !"))
        .catch(err => console.error(err));
    }
  });
})();
