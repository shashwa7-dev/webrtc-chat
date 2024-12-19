"use client";
import Peer from "peerjs";
import {
  createContext,
  RefObject,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import io, { Socket } from "socket.io-client";

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  myVideoRef: RefObject<HTMLVideoElement>;
  stream: MediaStream | null;
  initializeUserCam: () => void;
  stopUserCam: () => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketContextProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [userID, setUserId] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const myVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Create socket connection
    const newSocket = io("http://localhost:3500");
    newSocket.on("connect", () => {
      console.log("Socket connected");
      setSocket(newSocket);
      setIsConnected(true);
    });

    newSocket.on("user", (id) => {
      console.log("user", id);
      setUserId(id);
    });

    newSocket.on("disconnect", () => {
      console.log("Socket disconnected");
      setSocket(null);
      setIsConnected(false);
    });

    // Cleanup on unmount
    return () => {
      newSocket.disconnect();
    };
  }, []);

  const initializeUserCam = useCallback(() => {
    if (!userID) return;
    const peer = new Peer(userID);
    peer.on("open", (id) => {
      console.log("peer connected with : ", id);
    });
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((currentStream) => {
        setStream(currentStream);
        if (myVideoRef.current) {
          myVideoRef.current.srcObject = currentStream;
        } else {
          console.error("Video ref is not attached to the video element.");
        }
      })
      .catch(() => {
        alert("Cam access blocked!");
      });
  }, [myVideoRef.current, setStream, userID]);

  const stopUserCam = () => {
    if (stream) {
      // Stop all tracks in the stream
      stream.getTracks().forEach((track) => track.stop());
      setStream(null); // Clear the state
    }
  };

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        stream,
        myVideoRef,
        initializeUserCam,
        stopUserCam,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error("useSocket must be used within a SocketContextProvider");
  }
  return context;
};
