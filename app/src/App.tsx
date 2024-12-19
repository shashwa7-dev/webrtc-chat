import React, { useState, useCallback, useEffect } from "react";
import VideoCall from "./Video";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "./components/ui/button";

const App: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [roomId, setRoomId] = useState(searchParams.get("room") ?? "");
  const [inCall, setInCall] = useState(false);
  const navigate = useNavigate();
  const createRoom = () => {
    const newRoomId = Math.random().toString(36).substring(7);
    setRoomId(newRoomId);
    setInCall(true);
    navigate(`?room=${newRoomId}`);
  };

  const joinRoom = () => {
    if (roomId.trim()) {
      setInCall(true);
    }
  };

  useEffect(() => {
    if (searchParams.get("room")) {
      joinRoom();
    }
  }, []);
  return (
    <div className="app min-h-screen w-screen flex flex-col items-center justify-center">
      {!inCall ? (
        <div className="room-setup grid gap-6">
          <div className="max-w-md text-center">
            <h1 className="text-2xl font-bold text-center">
              Video calls and meetings for everyone
            </h1>
            <h2>
              Connect, collaborate, and celebrate from anywhere with lets meet!
            </h2>
          </div>
          <div className="grid gap-2">
            <Button onClick={createRoom} size={"lg"}>
              Create Room
            </Button>
            <p className="mx-auto">or</p>
            <div className="buttons flex border p-1 rounded-lg">
              <input
                type="text"
                placeholder="Enter Room ID"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className="w-full border rounded px-2"
              />
              <Button onClick={joinRoom} variant={"link"} className="">
                Join Room
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <VideoCall
          roomId={roomId}
          onCallEnd={() => {
            setInCall(false);
            setRoomId("");
            navigate("/");
          }}
        />
      )}
    </div>
  );
};

export default App;
