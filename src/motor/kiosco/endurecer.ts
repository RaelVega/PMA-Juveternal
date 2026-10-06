/**
 * Endurecimiento del kiosco: sin menú contextual, sin arrastrar imágenes, sin
 * zoom por gesto ni por teclado. La parte que se resuelve con CSS
 * (selección, resaltado de toque, rebote de scroll) vive en `kiosco.css`.
 * Devuelve la función que deshace todo, para las pruebas.
 */
export function endurecerKiosco(documento: Document = document): () => void {
  const bloquear = (evento: Event): void => evento.preventDefault();
  const bloquearZoomTeclado = (evento: KeyboardEvent): void => {
    if ((evento.ctrlKey || evento.metaKey) && ['+', '-', '=', '0'].includes(evento.key)) evento.preventDefault();
  };
  const bloquearZoomRueda = (evento: WheelEvent): void => {
    if (evento.ctrlKey) evento.preventDefault();
  };

  const opciones: AddEventListenerOptions = { passive: false, capture: true };
  documento.addEventListener('contextmenu', bloquear, opciones);
  documento.addEventListener('dragstart', bloquear, opciones);
  documento.addEventListener('gesturestart', bloquear, opciones);
  documento.addEventListener('keydown', bloquearZoomTeclado, opciones);
  documento.addEventListener('wheel', bloquearZoomRueda, opciones);

  return () => {
    documento.removeEventListener('contextmenu', bloquear, opciones);
    documento.removeEventListener('dragstart', bloquear, opciones);
    documento.removeEventListener('gesturestart', bloquear, opciones);
    documento.removeEventListener('keydown', bloquearZoomTeclado, opciones);
    documento.removeEventListener('wheel', bloquearZoomRueda, opciones);
  };
}
