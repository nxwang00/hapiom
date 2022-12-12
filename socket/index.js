const server = require("http").createServer();
const io = require("socket.io")(server, {
  cors: {
    origin: "*",
  },
  path: "/nodesock/socket.io/",
});
var mysql = require("mysql");

const PORT = 4000;
const NEW_MESSAGE = "newMessage";
const REQUEST_USER = "requestUser";
const REGISTER_USER = "registerUser";
const CHAT_HISTORY = "chatHistory";

const db_config = require("./mysql");

var MysqlConnect;

function handleDisconnect() {
  MysqlConnect = mysql.createConnection(db_config); // Recreate the connection, since
  // the old one cannot be reused.

  MysqlConnect.connect(function (err) {
    // The server is either down
    if (err) {
      // or restarting (takes a while sometimes).
      console.log("error when connecting to db:", err);
      setTimeout(handleDisconnect, 2000); // We introduce a delay before attempting to reconnect,
    } // to avoid a hot loop, and to allow our node script to
    console.log("DB Connected!");
  }); // process asynchronous requests in the meantime.
  // If you're also serving http, display a 503 error.
  MysqlConnect.on("error", function (err) {
    console.log("db error", err);
    if (err.code === "PROTOCOL_CONNECTION_LOST") {
      // Connection to the MySQL server is usually
      handleDisconnect(); // lost due to either server restart, or a
    } else {
      // connnection idle timeout (the wait_timeout
      throw err; // server variable configures this)
    }
  });
}

handleDisconnect();

let sockets = [];

io.on("connection", (socket) => {
  console.log(`Client ${socket.id} connected`);
  socket.emit(REQUEST_USER, null);

  // Listen for registering new user
  socket.on(REGISTER_USER, (data) => {
    // Save the socket object with user
    const userSocket = sockets.find((s) => s.userId === data.userId);
    if (userSocket) {
      var index = sockets.indexOf(userSocket);
      if (index !== -1) {
        sockets.splice(index, 1);
      }
    }
    socket.userId = data.userId;
    sockets.push(socket);

    console.log(sockets);
    // Set message to read
    // MysqlConnect.query(
    //   "UPDATE messages SET is_seen=? WHERE user_id=? AND receiver_id=? AND is_seen=?",
    //   [1, data.partner, data.user, 0],
    //   (err, res) => {
    //     if (err) {
    //       console.log(err);
    //     }
    //   }
    // );
  });

  // Listen for new messages
  socket.on(NEW_MESSAGE, (data) => {
    let receiverId = data.receiver;
    let senderId = data.sender;
    let message = data.body;
    MysqlConnect.query(
      "INSERT INTO messages SET ufrom=?, uto=?, message=?",
      [senderId, receiverId, message],
      (err, res) => {
        if (err) {
          console.log(err);
        }
      }
    );
    for (let s of sockets) {
      if (s.userId == receiverId) {
        s.emit(NEW_MESSAGE, data);
      }
    }
  });

  // Leave the room if the user closes the socket
  socket.on("disconnect", () => {
    console.log(`Client ${socket.id} diconnected`);
    var index = sockets.indexOf(socket);
    if (index !== -1) {
      sockets.splice(index, 1);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
