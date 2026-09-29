import React, { useState, useEffect } from 'react';
import './i18n/index.js';
import { Navbar } from './components/Navbar.js';
import { LandingPage } from './components/LandingPage.js';
import { CreateRoomModal } from './components/CreateRoomModal.js';
import { JoinRoomModal } from './components/JoinRoomModal.js';
import { WatchRoom } from './components/WatchRoom.js';

interface ActiveRoomSession {
  roomId: string;
  userName: string;
}

export const App: React.FC = () => {
  const [activeRoom, setActiveRoom] = useState<ActiveRoomSession | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [inviteRoomCode, setInviteRoomCode] = useState<string>('');

  // Check URL query parameters for ?room=CODE
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
      setInviteRoomCode(roomParam.toUpperCase());
      setIsJoinOpen(true);
    }
  }, []);

  const handleRoomCreated = (roomId: string, userName: string) => {
    // Update URL without full reload
    const newUrl = `${window.location.pathname}?room=${roomId}`;
    window.history.pushState({ path: newUrl }, '', newUrl);

    setActiveRoom({ roomId, userName });
    setIsCreateOpen(false);
  };

  const handleRoomJoined = (roomId: string, userName: string) => {
    // Update URL without full reload
    const newUrl = `${window.location.pathname}?room=${roomId}`;
    window.history.pushState({ path: newUrl }, '', newUrl);

    setActiveRoom({ roomId, userName });
    setIsJoinOpen(false);
  };

  const handleLeaveRoom = () => {
    setActiveRoom(null);
    // Clear room query parameter
    window.history.pushState({}, '', window.location.pathname);
  };

  if (activeRoom) {
    return (
      <WatchRoom
        roomId={activeRoom.roomId}
        userName={activeRoom.userName}
        onLeave={handleLeaveRoom}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#08090d] text-zinc-100 flex flex-col font-sans selection:bg-rose-500/30 selection:text-rose-200">
      <Navbar
        onCreateRoom={() => setIsCreateOpen(true)}
        onJoinRoom={() => setIsJoinOpen(true)}
      />

      <main className="flex-1">
        <LandingPage
          onCreateRoom={() => setIsCreateOpen(true)}
          onJoinRoom={() => setIsJoinOpen(true)}
        />
      </main>

      {/* Modals */}
      <CreateRoomModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onRoomCreated={handleRoomCreated}
      />

      <JoinRoomModal
        isOpen={isJoinOpen}
        initialRoomCode={inviteRoomCode}
        onClose={() => setIsJoinOpen(false)}
        onJoinRoom={handleRoomJoined}
      />
    </div>
  );
};

export default App;
