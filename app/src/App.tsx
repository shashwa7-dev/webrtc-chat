import React, { useState, useEffect } from "react";
import { useSocket } from "./context/socket";

const ChatApp: React.FC = () => {
  const { socket } = useSocket();
  const [messages, setMessages] = useState<String[]>([]);
  const [inputMessage, setInputMessage] = useState<string>("");

  useEffect(() => {
    if (!socket) return;

    const handleMessage = (message: String) => {
      setMessages((prevMessages: String[]) => [...prevMessages, message]);
    };

    // Listen for incoming messages
    socket.on("chat_log", handleMessage);

    return () => {
      socket.off("chat_log", handleMessage); // Clean up the listener
      socket.disconnect(); // Disconnect socket on component unmount
    };
  }, [socket]);

  const sendMessage = () => {
    if (inputMessage.trim() && socket) {
      // Emit message to the server
      socket.emit("message", inputMessage);
      setInputMessage(""); // Clear input
    }
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h2>Simple Chat</h2>
      <div
        style={{
          border: "1px solid #ccc",
          borderRadius: "5px",
          padding: "10px",
          maxHeight: "300px",
          overflowY: "auto",
          marginBottom: "10px",
        }}
      >
        {messages.map((msg, index) => (
          <div key={index}>
            <strong>{msg}</strong>
          </div>
        ))}
      </div>
      <input
        type="text"
        value={inputMessage}
        onChange={(e) => setInputMessage(e.target.value)}
        placeholder="Type your message..."
        style={{
          padding: "10px",
          width: "calc(100% - 80px)",
          marginRight: "10px",
          border: "1px solid #ccc",
          borderRadius: "5px",
        }}
      />
      <button
        onClick={sendMessage}
        style={{
          padding: "10px",
          backgroundColor: "#007BFF",
          color: "white",
          border: "none",
          borderRadius: "5px",
          cursor: "pointer",
        }}
      >
        Send
      </button>
    </div>
  );
};

export default ChatApp;
