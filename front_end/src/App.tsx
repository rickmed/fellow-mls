import { Header } from "./components/Header"
import { Filters } from "./components/Filters"

function App() {

  const sepStyle = {
    borderBottom: "1px solid",
    transform: "scaleY(0.5)",
    borderColor: "#737373",
  }

  return (
    <section className="antialiased text-gray-900">
      <Header/>
      <div aria-label="separator" style={sepStyle} className="mt-3"></div>
      <Filters/>
    </section>
  )
}

export default App
