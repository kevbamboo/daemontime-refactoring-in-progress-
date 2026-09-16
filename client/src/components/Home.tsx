import GameBox from './GameBox';
import AuthModal from './AuthModal';
export default function Home({ authenticated }: { authenticated: boolean }) {
  return authenticated ? <GameBox /> : <AuthModal />;
}
