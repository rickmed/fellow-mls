import { Header } from "./components/Header"

function App() {
  return (
    <section className="antialiased text-gray-900">
      <Header/>
      <div>
        <button className="border-gray-300 border-4">Apartamento | Casa | Oficina</button>
        <button>Venta | Alquiler</button>
        <button>Precio: Min | Max</button>
        <button>Habitaciones: Min | Max</button>
        <button>Baños: Min | Max</button>
        <button>Metros: Minx| Max</button>
      </div>
    </section>
  )
}

export default App
