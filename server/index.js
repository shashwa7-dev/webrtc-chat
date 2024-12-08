import express from "express";
import { Server } from "socket.io";

const PORT = process.env.PORT || 3500;

const app = express();

const expressServer = app.listen(PORT, () => {
  console.log(`listening on port ${PORT}`);
});

const io = new Server(expressServer, {
  cors: {
    origin:
      process.env.NODE_ENV === "production"
        ? false
        : ["http://localhost:5173", "http://127.0.0.1:5173"],
  },
});

io.on("connection", (socket) => {
  console.log(`User ${socket.id} connected`);
  socket.on("message", (text) => {
    //chat_log is an custom name event
    io.emit("chat_log", `${socket.id.substring(0, 5)}: ${text}`);
  });
});
