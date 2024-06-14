export function Filters() {
   return (
      <div className="mt-4 flex justify-center gap-4 text-zinc-600 text-sm font-semibold">
        <button className="border bg-white px-4 py-2 rounded-md">Apartamento</button>
        <button className="border bg-white px-4 py-1 rounded-md">Venta</button>
        <button className="border bg-white px-4 py-1 rounded-md">Precio</button>
        <button className="border bg-white px-4 py-1 rounded-md">Habitaciones</button>
        <button className="border bg-white px-4 py-1 rounded-md">Baños</button>
        <button className="border bg-white px-4 py-1 rounded-md">Metros</button>
      </div>
   )
}