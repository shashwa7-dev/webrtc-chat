import express from "express";
import { Server, Socket as SocketIO } from "socket.io";

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

// Enhanced room structure to track user states
interface RoomState {
  users: string[];
  states: {
    [userId: string]: {
      audioMuted: boolean;
      videoOff: boolean;
      callDropped: boolean;
    };
  };
}

const rooms: { [roomId: string]: RoomState } = {};

io.on("connection", (socket: SocketIO) => {
  console.log("New client connected:", socket.id);

  socket.on("join-room", (roomId: string, userId: string) => {
    console.log(`Join room event received - Room: ${roomId}, User: ${userId}`);

    // Create room if it doesn't exist
    if (!rooms[roomId]) {
      rooms[roomId] = { users: [], states: {} };
    }

    // Check room capacity (max 2 users)
    if (rooms[roomId].users.length >= 2) {
      socket.emit("room-full", roomId);
      return;
    }

    // Add user to room if not already present
    if (!rooms[roomId].users.includes(userId)) {
      rooms[roomId].users.push(userId);

      // Initialize user state
      rooms[roomId].states[userId] = {
        audioMuted: false,
        videoOff: false,
        callDropped: false,
      };

      socket.join(roomId);

      // Broadcast to other users in the room
      socket.to(roomId).emit("user-connected", {
        userId,
        ...rooms[roomId].states[userId],
      });

      // Send room state to the newly joined user
      socket.emit("room-users", {
        users: rooms[roomId].users,
        states: rooms[roomId].states,
      });

      console.log(`User ${userId} added to room ${roomId}`);
    }
  });

  // New event to update and broadcast user media states
  socket.on(
    "update-media-state",
    (
      roomId: string,
      state: { audioMuted: boolean; videoOff: boolean; callDropped: boolean }
    ) => {
      if (rooms[roomId] && rooms[roomId].states[socket.id]) {
        rooms[roomId].states[socket.id] = state;
        socket.to(roomId).emit("user-media-state-changed", {
          userId: socket.id,
          ...state,
        });
      }
    }
  );

  socket.on("offer", (roomId, offer) => {
    console.log(`Offer received - Room: ${roomId}`);
    socket.to(roomId).emit("offer", offer);
  });

  socket.on("answer", (roomId, answer) => {
    console.log(`Answer received - Room: ${roomId}`);
    socket.to(roomId).emit("answer", answer);
  });

  socket.on("ice-candidate", (roomId, candidate) => {
    console.log(`ICE candidate received - Room: ${roomId}`);
    socket.to(roomId).emit("ice-candidate", candidate);
  });

  socket.on("error", (error) => {
    console.error("Socket error:", error);
  });

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
    for (const roomId in rooms) {
      const userIndex = rooms[roomId].users.indexOf(socket.id);
      if (userIndex !== -1) {
        rooms[roomId].users.splice(userIndex, 1);
        delete rooms[roomId].states[socket.id];

        // Notify remaining users about the disconnection
        socket.to(roomId).emit("user-disconnected", socket.id);

        // Remove room if no users are left
        if (rooms[roomId].users.length === 0) {
          delete rooms[roomId];
        }

        console.log(`User ${socket.id} removed from room ${roomId}`);
      }
    }
  });
});
