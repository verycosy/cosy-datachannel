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
});

server.listen(PORT, () => console.log("Listening ..."));
