export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-center">
        <div className="text-6xl font-bold text-[#1B3A6B] mb-4">404</div>
        <h1 className="text-xl font-semibold text-white mb-2">Página no encontrada</h1>
        <p className="text-slate-400 text-sm mb-6">
          La página que busca no existe en CERNIQ.
        </p>
        <a href="/" className="text-[#F59E0B] hover:underline text-sm">
          Volver al inicio →
        </a>
      </div>
    </div>
  );
}
