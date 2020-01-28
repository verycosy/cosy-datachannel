"use strict";

const socket = io();

const dropbox = document.getElementById("dropbox");
const sentList = document.getElementById("sentList");
const receivedList = document.getElementById("receivedList");
const connectBtn = document.getElementById("connect");
const disconnectBtn = document.getElementById("disconnect");
const chatList = document.getElementById("chatList");
const chat = document.getElementById("chat");

const channelStateLabel = document.getElementById("channelState");

let pc = null,
  channel = null;

const pcConfig = null;

const DATA_TYPE = {
  CHAT: 0,
  METADATA: 1,
  BLOB: 2
};

const CHAT_TYPE = {
  ME: 0,
  YOU: 1
};

let receivedFileList = null;
const chunkSize = 16 * 1024;
const bodyColor = `white`,
  progressColor = `#f8ce5b`;

//FIXME: Directoy Not Supported Yet
function handleFileSelect(evt) {
  evt.preventDefault();

  const files = evt.target.files || evt.dataTransfer.files;

  addFilesToList(files);
  sendFiles(files);
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

// function makeProgressBar(li) {
//   return evt => {
//     console.log(evt);
//     if (evt.lengthComputable) {
//       const percentage = Math.round((evt.loaded / evt.total) * 100);
//       console.log(evt.loaded + " / " + evt.total);

//       li.style.backgroundImage = `linear-gradient(to right, ${progressColor} ${percentage}%, ${bodyColor} ${100 -
//         percentage}%)`;
//     }
//   };
// }

function addFilesToList(files) {
  sentList.innerHTML = "";

  const metadataObj = {};

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    metadataObj[file.name] = {
      buffer: [],
      receivedSize: 0,
      totalSize: file.size
    };

    const li = document.createElement("li");
    li.textContent = `${file.name} + (${prettySize(file.size)})`;
    sentList.appendChild(li);
  }

  channel.send(
    JSON.stringify({
      message: metadataObj,
      type: DATA_TYPE.METADATA
    })
  );
}

function sendFiles(files) {
  const readSlice = (file, offset) => {
    console.log(file.name, ">", offset);
    return file.slice(offset, offset + chunkSize);
  };

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    // case by case error handling, abort
    const reader = new FileReader();
    let offset = 0;

    reader.onload = ({ target: { result } }) => {
      // if (file.type.match("image/*")) {
      //   const img = document.createElement("img");
      //   img.src = evt.target.result;
      //   li.append(img);
      //   sentList.appendChild(li);
      // } else {

      // }

      // console.log(evt);
      offset += result.byteLength;

      channel.send(
        JSON.stringify({
          message: {
            base64: encode(result),
            fileName: file.name
          },
          type: DATA_TYPE.BLOB
        })
      );

      if (offset < file.size) reader.readAsArrayBuffer(readSlice(file, offset));
    };

    reader.readAsArrayBuffer(readSlice(file, 0));

    // reader.onprogress = makeProgressBar(li);
    // reader.readAsDataURL(file);
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
    chat.placeholder = "DataChannel Opened";
  } else {
    if (state === "close") disconnect();
    else {
      connectBtn.disabled = false;
      disconnectBtn.disabled = true;
      chat.disabled = true;
      chat.placeholder = "DataChannel Closed";
    }
  }
}

function handleChannelMessage(evt) {
  const { type, message } = JSON.parse(evt.data);

  switch (type) {
    case DATA_TYPE.CHAT:
      attachChat(message, CHAT_TYPE.YOU);
      break;
    case DATA_TYPE.METADATA:
      console.time("GOT METADATA");
      receivedList.innerHTML = "";
      receivedFileList = message;

      for (let fileName in receivedFileList) {
        const li = document.createElement("li");
        li.textContent = fileName;
        receivedList.append(li);
      }

      break;
    case DATA_TYPE.BLOB:
      const { base64, fileName } = message;

      const arraybuffer = decode(base64);
      const receivedFile = receivedFileList[fileName];

      receivedFile.receivedSize += arraybuffer.byteLength;
      receivedFileList[fileName].buffer.push(arraybuffer);

      if (receivedFile.receivedSize === receivedFile.totalSize) {
        const allBuffer = new Blob(receivedFile.buffer);

        const a = document.createElement("a");
        a.href = URL.createObjectURL(allBuffer);
        a.download = fileName;
        a.click();
        console.timeEnd("GOT METADATA");
      }

      break;
  }
}

function addEventToChannel() {
  channel.addEventListener("error", evt => console.log(evt));
  channel.addEventListener("open", handleChannelState);
  channel.addEventListener("close", handleChannelState);
  channel.addEventListener("message", handleChannelMessage);
}

async function connect() {
  if (!pc) makePeerConnection();

  channel = pc.createDataChannel("cosy-datachannel"); // 혹은 각각의 파일을 위한 별도의 채널들 path기준
  addEventToChannel();

  try {
    const desc = await pc.createOffer();
    pc.setLocalDescription(desc); // firefox에서 stun failed 오류; icecandidate 발생 안함 -> 서버 재실행하니까 되네?(vscode reload)
    // 크롬,파이어폭스 모두 새로고침을 해도 데이터채널이 유지되는 듯 하다. 그거랑 연관있나? 테스트 필요
    socket.emit("offer", desc);
  } catch (err) {
    console.error(err);
  }
}

function disconnect() {
  if (channel) channel.close();
  if (pc) pc.close();

  channel = null;
  pc = null;

  connectBtn.disabled = false;
  disconnectBtn.disabled = true;
  chat.disabled = true;
  chat.placeholder = "DataChannel Closed";

  console.log("disconnected");
}

function makePeerConnection() {
  pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });

  pc.addEventListener("icecandidate", evt => {
    console.log(evt);
    if (evt.candidate) socket.emit("icecandidate", evt.candidate);
  });
  pc.addEventListener("connectionstatechange", evt => console.log(evt));
  pc.addEventListener("icecandidateerror", evt => console.log(evt));
  pc.addEventListener("negotiationneeded", evt => console.log(evt));
  pc.addEventListener("datachannel", evt => {
    channel = evt.channel;
    addEventToChannel();
  });
}

function attachChat(text, chatType) {
  const li = document.createElement("li");
  li.textContent = text;
  li.className = chatType === CHAT_TYPE.ME ? "me" : "you";
  chatList.appendChild(li);
}

function sendMessage(evt) {
  if (evt.key === "Enter") {
    channel.send(
      JSON.stringify({
        message: evt.target.value,
        type: DATA_TYPE.CHAT
      })
    );
    attachChat(evt.target.value, CHAT_TYPE.ME);
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

  console.log(pc);

  socket.on("offer", async offerSDP => {
    if (!pc) makePeerConnection();

    try {
      await pc.setRemoteDescription(offerSDP);

      const answerSDP = await pc.createAnswer();
      pc.setLocalDescription(answerSDP);
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
