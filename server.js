"use strict";

const express = require("express"),
  http = require("http"),
  socketIO = require("socket.io");

const PORT = 5020;

const app = express();

app.use(express.static("public"));
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

const server = http.createServer(app);
const io = socketIO(server);

io.on("connection", socket => {
  console.log("Someone Connected");

  socket.on("offer", desc => {
    console.log("Somone offered");
    socket.broadcast.emit("offer", desc);
  });

  socket.on("answer", desc => {
    console.log("Someone answered");
    socket.broadcast.emit("answer", desc);
  });

  socket.on("icecandidate", candidate => {
    console.log("exchange candidate");
    socket.broadcast.emit("icecandidate", candidate);
  });
});

server.listen(PORT, () => console.log("Listening ..."));
