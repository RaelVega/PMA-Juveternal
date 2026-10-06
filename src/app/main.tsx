import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../motor/kiosco/kiosco.css';
import '../marca/tokens/tokens.css';
import { PruebaHumo } from '../humo/PruebaHumo';
import { App } from '../marca/App';
import { aplicarTokensMovimiento } from '../marca/tokens/movimiento';
import { endurecerKiosco } from '../motor/kiosco/endurecer';
import { Lienzo } from '../motor/lienzo/Lienzo';

const parametros = new URLSearchParams(window.location.search);
// En desarrollo el cursor se ve siempre; en el kiosco, solo con ?cursor=1.
if (import.meta.env.DEV || parametros.has('cursor')) document.documentElement.dataset['cursor'] = '';
aplicarTokensMovimiento();
endurecerKiosco();

const raiz = document.getElementById('raiz');
if (!raiz) throw new Error('Falta #raiz en index.html');

// ?humo abre la prueba técnica de distribución en lugar de la experiencia (ver LEEME de la USB).
createRoot(raiz).render(
  <StrictMode>
    <Lienzo>{parametros.has('humo') ? <PruebaHumo /> : <App />}</Lienzo>
  </StrictMode>,
);
