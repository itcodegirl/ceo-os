import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import ImportRecoveryGate from './components/ui/ImportRecoveryGate';

import '@fontsource-variable/inter';
import './styles/base.css';
import './styles/layout.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ImportRecoveryGate><App /></ImportRecoveryGate>
    </BrowserRouter>
  </React.StrictMode>
);
