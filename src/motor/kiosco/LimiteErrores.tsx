import { Component, Fragment, type ErrorInfo, type ReactNode } from 'react';

interface Propiedades {
  /** Se llama con cada error de render: la experiencia vuelve a la portada y limpia la sesión. */
  alFallar: (error: unknown) => void;
  children: ReactNode;
}

interface Estado {
  fallo: boolean;
  generacion: number;
}

/**
 * Límite de errores global. Si una pantalla revienta, avisa (`alFallar`
 * reinicia el flujo) y vuelve a montar a los hijos desde cero: nunca se
 * queda una pantalla en blanco.
 */
export class LimiteErrores extends Component<Propiedades, Estado> {
  override state: Estado = { fallo: false, generacion: 0 };

  static getDerivedStateFromError(): Partial<Estado> {
    return { fallo: true };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('Error de render, se reinicia la experiencia', error, info.componentStack);
    this.props.alFallar(error);
  }

  override componentDidUpdate(): void {
    if (this.state.fallo) this.setState((previo) => ({ fallo: false, generacion: previo.generacion + 1 }));
  }

  override render(): ReactNode {
    if (this.state.fallo) return null;
    return <Fragment key={this.state.generacion}>{this.props.children}</Fragment>;
  }
}
