import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import MainBoard from './pages/MainBoard';
import MasterSettings from './pages/MasterSettings';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<MainBoard />} />
          <Route path="/masters" element={<MasterSettings />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
