import React, { useCallback, useEffect, useRef, useState } from "react";
import io, { Socket } from "socket.io-client";
import {
  MicIcon,
  MicOffIcon,
  VideoIcon,
  VideoOffIcon,
  PhoneOffIcon,
  VideoOff,
} from "lucide-react";
import { Button } from "./components/ui/button";
import { toast } from "sonner";
import { cn } from "./lib/utils";

interface VideoCallProps {
  roomId: string;
  onCallEnd: () => void;
}

const VideoCall: React.FC<VideoCallProps> = ({ roomId, onCallEnd }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);

  // State for remote stream and user
  const [remoteStreamAvailable, setRemoteStreamAvailable] = useState(false);
  const [remoteUserMediaState, setRemoteUserMediaState] = useState({
    audioMuted: false,
    videoOff: false,
    callDropped: false,
  });
  // State for media controls
  const [isMicrophoneMuted, setIsMicrophoneMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  // Copy room link
  const copyRoomLink = () => {
    const roomLink = `${window.location.origin}?room=${roomId}`;
    navigator.clipboard
      .writeText(roomLink)
      .then(() => {
        toast.info("Room link copied to clipboard!");
      })
      .catch((err) => {
        toast.error("Failed to copy room link:", err);
      });
  };
  // Broadcast media state change
  const broadcastMediaState = useCallback(
    (state: {
      audioMuted?: boolean;
      videoOff?: boolean;
      callDropped?: boolean;
    }) => {
      if (socket) {
        socket.emit("update-media-state", roomId, state);
      }
    },
    [socket, roomId]
  );

  // Toggle microphone with broadcast
  const toggleMicrophone = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach((track) => {
        track.enabled = !track.enabled;
      });
      const newMuteState = !isMicrophoneMuted;
      setIsMicrophoneMuted(newMuteState);
      broadcastMediaState({ audioMuted: newMuteState });
    }
  };

  // Toggle video
  const toggleVideo = useCallback(async () => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();

      if (!isVideoOff) {
        // Turn off camera by stopping the video tracks
        videoTracks.forEach((track) => track.stop());
      } else {
        try {
          // Restart video by requesting a new video stream
          const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
          });
          const newVideoTrack = stream.getVideoTracks()[0];

          // Replace the old video track in the peer connection
          const sender = peerConnectionRef.current
            ?.getSenders()
            .find((s) => s.track?.kind === "video");
          if (sender) {
            sender.replaceTrack(newVideoTrack);
          }

          // Update the local stream and video element
          localStreamRef.current?.removeTrack(videoTracks[0]);
          localStreamRef.current?.addTrack(newVideoTrack);

          if (localVideoRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
          }
        } catch (error) {
          console.error("Error restarting video:", error);
        }
      }

      const newVideoState = !isVideoOff;
      setIsVideoOff(newVideoState);
      broadcastMediaState({ videoOff: newVideoState });
    }
  }, [isVideoOff, broadcastMediaState]);
  // End call
  const endCall = () => {
    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null; // Clear the reference
    }

    // Stop and clear local stream tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null; // Clear the reference
    }

    // Clear the local video element source
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
      broadcastMediaState({ callDropped: true });
    }

    // Disconnect socket
    if (socket) {
      socket.disconnect();
      setSocket(null); // Clear the socket reference
    }

    setRemoteStreamAvailable(false); // Update state for UI
    // Call parent component's end call method
    onCallEnd();
  };
  useEffect(() => {
    // Create socket connection
    const newSocket = io("http://localhost:3500", {
      reconnection: true,
      reconnectionAttempts: 5,
    });
    // Store socket in state
    setSocket(newSocket);

    newSocket.on("connect", () => {
      console.log("Socket connected successfully");
      console.log("Socket ID:", newSocket.id);
    });

    newSocket.on("connect_error", (error) => {
      console.error("Connection Error:", error);
    });

    // Handle room full scenario
    newSocket.on("room-full", () => {
      toast.warning("Room is full :(", {
        description: "A Room can have max upto 2 candidates.",
      });
      endCall();
    });

    // Handle remote user media state changes
    newSocket.on("user-media-state-changed", (mediaState) => {
      console.log("media stats for user id", mediaState);
      setRemoteUserMediaState((prev) => ({
        ...prev,
        ...mediaState,
      }));
    });

    // Initialize WebRTC
    const initWebRTC = async () => {
      try {
        // Get user media
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        // Store local stream
        localStreamRef.current = stream;

        // Set local video source
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Create peer connection
        const configuration = {
          iceServers: [
            {
              urls: [
                "stun:stun1.l.google.com:19302",
                "stun:stun2.l.google.com:19302",
              ],
            },
          ],
          iceCandidatePoolSize: 10,
        };
        const peerConnection = new RTCPeerConnection(configuration);

        // Add local stream tracks to peer connection
        stream.getTracks().forEach((track) => {
          peerConnection.addTrack(track, stream);
        });

        // Handle incoming remote tracks
        peerConnection.ontrack = (event) => {
          console.log("Remote track received");
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = event.streams[0];
            setRemoteStreamAvailable(true); // Update state
          }
        };

        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
          if (event.candidate && newSocket) {
            console.log("Sending ICE candidate");
            newSocket.emit("ice-candidate", roomId, event.candidate);
          }
        };

        peerConnectionRef.current = peerConnection;
        // Modify the ontrack handler to store the remote stream
        peerConnection.ontrack = (event) => {
          console.log("Remote track received");
          remoteStreamRef.current = event.streams[0];

          if (remoteVideoRef.current && !remoteUserMediaState.videoOff) {
            remoteVideoRef.current.srcObject = event.streams[0];
            setRemoteStreamAvailable(true);
          }
        };

        // Ensure socket is connected before joining room
        if (newSocket.connected) {
          console.log("Attempting to join room:", roomId);
          newSocket.emit("join-room", roomId, newSocket.id);
        } else {
          console.warn("Socket not connected, waiting for connection");
        }

        // Socket event handlers
        newSocket.on("user-connected", async (userId: string) => {
          console.log("User connected:", userId);
          try {
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            console.log("Sending offer");
            newSocket.emit("offer", roomId, offer);
          } catch (offerError) {
            console.error("Error creating offer:", offerError);
          }
        });

        newSocket.on("offer", async (offer: RTCSessionDescriptionInit) => {
          console.log("Received offer");
          try {
            await peerConnection.setRemoteDescription(
              new RTCSessionDescription(offer)
            );
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            console.log("Sending answer");
            newSocket.emit("answer", roomId, answer);
            //initialize media state
            newSocket.emit("update-media-state", roomId, {
              audioMuted: false,
              videoOff: false,
              callDropped: false,
            });
          } catch (answerError) {
            console.error("Error handling offer:", answerError);
          }
        });

        newSocket.on("answer", async (answer: RTCSessionDescriptionInit) => {
          console.log("Received answer");
          try {
            await peerConnection.setRemoteDescription(
              new RTCSessionDescription(answer)
            );
          } catch (answerSetError) {
            console.error("Error setting remote description:", answerSetError);
          }
        });

        newSocket.on(
          "ice-candidate",
          async (candidate: RTCIceCandidateInit) => {
            console.log("Received ICE candidate");
            try {
              await peerConnection.addIceCandidate(
                new RTCIceCandidate(candidate)
              );
            } catch (candidateError) {
              console.error("Error adding ICE candidate:", candidateError);
            }
          }
        );
      } catch (error) {
        console.error("WebRTC setup error:", error);
      }
    };

    // Initialize WebRTC after socket connection
    newSocket.on("connect", initWebRTC);

    // Cleanup function
    return () => {
      // Stop local stream tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }

      // Close peer connection
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }

      // Disconnect socket
      if (newSocket) {
        newSocket.disconnect();
      }
    };
  }, [roomId]);

  // Add a useEffect to handle remote video state changes
  useEffect(() => {
    if (remoteVideoRef.current) {
      if (remoteUserMediaState.videoOff || remoteUserMediaState.callDropped) {
        remoteVideoRef.current.srcObject = null;
      } else if (remoteStreamRef.current) {
        remoteVideoRef.current.srcObject = remoteStreamRef.current;
      }
    }
  }, [
    remoteUserMediaState.videoOff,
    remoteUserMediaState.callDropped,
    remoteVideoRef.current,
  ]);
  // Add a useEffect to handle local video state changes
  useEffect(() => {
    if (localVideoRef.current) {
      if (isVideoOff) {
        localVideoRef.current.srcObject = null;
      } else if (localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
    }
  }, [isVideoOff, localVideoRef.current]);

  return (
    <div className="video-call w-screen relative h-screen overflow-hidden flex flex-col items-center justify-center p-4">
      <div className="video-container relative w-full max-w-4xl aspect-video">
        {isVideoOff ? (
          <div
            className={cn(
              "bg-accent border-2",
              !remoteStreamAvailable || remoteUserMediaState?.callDropped
                ? `w-full h-full object-cover rounded-lg  p-2 grid place-items-center`
                : `absolute bottom-4 right-4 w-1/4 h-1/4  object-cover rounded-lg p-2 `
            )}
          >
            <VideoOff
              className={cn(
                "text-accent-foreground",
                !remoteStreamAvailable || remoteUserMediaState?.callDropped
                  ? "w-[60px] h-[60px]"
                  : "w-[20px] h-[20px]"
              )}
            />
          </div>
        ) : (
          <video
            ref={localVideoRef}
            autoPlay
            className={cn(
              "rounded-lg overflow-hidden",
              !remoteStreamAvailable || remoteUserMediaState?.callDropped
                ? "w-full h-full object-cover"
                : "absolute bottom-4 right-4 w-1/4 h-1/4 object-cover"
            )}
          />
        )}
        {remoteUserMediaState.videoOff ? (
          <div
            className={`w-full h-full object-cover rounded-lg  bg-accent  border-4 p-2 grid place-items-center`}
          >
            <VideoOff className="text-accent-foreground w-[80px] h-[80px]" />
          </div>
        ) : (
          <video
            ref={remoteVideoRef}
            autoPlay
            className={`w-full h-full object-cover rounded-lg`}
          />
        )}
      </div>

      <div className="controls absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
        <Button
          onClick={toggleMicrophone}
          variant={!isMicrophoneMuted ? "outline" : "default"}
        >
          {isMicrophoneMuted ? <MicOffIcon /> : <MicIcon />}
        </Button>

        <Button
          onClick={toggleVideo}
          variant={!isVideoOff ? "outline" : "default"}
        >
          {isVideoOff ? <VideoOffIcon /> : <VideoIcon />}
        </Button>

        <Button
          onClick={copyRoomLink}
          className="rounded-md bg-primary text-white"
        >
          Share Room
        </Button>

        <Button onClick={endCall}>
          <PhoneOffIcon />
        </Button>
      </div>

      <div className="room-info absolute top-4 left-4 bg-secondary text-secondary-foreground border-2 p-1 px-2 text-sm rounded-lg">
        <p>Room ID: {roomId}</p>
      </div>
    </div>
  );
};

export default VideoCall;
