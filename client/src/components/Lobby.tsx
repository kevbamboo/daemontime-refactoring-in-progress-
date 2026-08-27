type LobbyProps = {
  setIsLobby: React.Dispatch<React.SetStateAction<boolean>>;
};

export default function Lobby({ setIsLobby }: LobbyProps) {
  return (
    <>
      <button onClick={() => setIsLobby(false)}>Create Game</button>
    </>
  );
}
