import { Navigate, Route, Routes } from 'react-router-dom';

import Welcome from './pages/Welcome';
import LoginCpf from './pages/LoginCpf';
import VerificarOtp from './pages/VerificarOtp';
import Bloqueado from './pages/Bloqueado';
import Home from './pages/Home';
import AgendarLista from './pages/AgendarLista';
import AgendarConfirmacao from './pages/AgendarConfirmacao';
import SucessoInscricao from './pages/SucessoInscricao';
import MinhasInscricoes from './pages/MinhasInscricoes';
import HistoricoImersoes from './pages/HistoricoImersoes';
import ReagendarLista from './pages/ReagendarLista';
import CxContato from './pages/CxContato';
import Academico from './pages/Academico';
import { RequireAuth } from './components/RequireAuth';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Welcome />} />
      <Route path="/login" element={<LoginCpf />} />
      <Route path="/verificar" element={<VerificarOtp />} />
      <Route path="/bloqueado" element={<Bloqueado />} />

      <Route element={<RequireAuth />}>
        <Route path="/app" element={<Home />} />
        <Route path="/app/agendar" element={<AgendarLista />} />
        <Route path="/app/agendar/:id" element={<AgendarConfirmacao />} />
        <Route path="/app/sucesso/:id" element={<SucessoInscricao />} />
        <Route path="/app/minhas" element={<MinhasInscricoes />} />
        <Route path="/app/historico" element={<HistoricoImersoes />} />
        <Route path="/app/academico" element={<Academico />} />
        <Route path="/app/minhas/:id/reagendar" element={<ReagendarLista />} />
        <Route path="/app/cx" element={<CxContato />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
