import { useEffect, useRef, useState } from "react"

export function Filters() {
   return (
      <div className="mt-4 flex justify-center gap-4 text-zinc-600 text-mid font-semibold">
         <SwitchOptsButton opts={["Casa", "Apartamento", "Oficina"]} defaultOpt="Apartamento" />
         <SwitchOptsButton opts={["Venta", "Alquiler"]} defaultOpt="Alquiler" />
         <button className="border border-dark-blue bg-zinc-100 px-4 py-1 rounded-md">Precio</button>
         <button className="border border-dark-blue bg-zinc-100 px-4 py-1 rounded-md">Habitaciones</button>
         <button className="border border-dark-blue bg-zinc-100 px-4 py-1 rounded-md">Baños</button>
         <button className="border border-dark-blue bg-zinc-100 px-4 py-1 rounded-md">Metros</button>
      </div>
   )
}


function SwitchOptsButton<T extends string[]>(props: {opts: T, defaultOpt: T[number]}) {

   const {opts, defaultOpt } = props

   const [selectedTab, setTab] = useState<T[number]>(defaultOpt)
   const markerRef = useRef<HTMLDivElement>(null)
   const OptsRefs = useRef<Record<T[number], HTMLButtonElement>>({} as Record<T[number], HTMLButtonElement>)

   useEffect(() => {
      const inmueblesElem = OptsRefs.current[selectedTab]
      const markerElem = markerRef.current
      if (markerElem) {
         markerElem.style.width = `${inmueblesElem.offsetWidth}px`;
         markerElem.style.left = `${inmueblesElem.offsetLeft}px`;
      }
   }, [selectedTab])

   const markerStyle = {
      transition: "left 0.3s ease-in-out, width 0.3s ease-in-out",
   }

   const selectedStyleColorAnimation = {
      transition: "color 0.3s ease-in-out",
   }

   const elem = (
      <div aria-label="tipo de inmueble" className="relative flex items-stretch border rounded-md border-dark-blue bg-zinc-100 overflow-hidden">

         <div ref={markerRef} aria-label="marker" style={markerStyle} className="absolute top-0 bottom-0 left-0 right-0 bg-med-blue w-1"></div>

         {opts.map(opt => [opt, "border"]).flat().slice(0, -1).map((val, idx) => {

            if (val === "border") {
               return <div arial-label="inner border" className="w-px border-1 bg-zinc-300"></div>
            }

            const _selectedStyle = selectedTab === val ? "text-white" : ""
            let style = "px-3 py-2 z-10 border-0 " + _selectedStyle

            return (
               <button
                  key={idx} onClick={() => setTab(val)}
                  className={style}
                  style={selectedStyleColorAnimation}
                  ref={(el: HTMLButtonElement) => OptsRefs.current[val as T[number]] = el}
               >
                  {val}
               </button>
            )
         })}
      </div>
   )

   return elem
}
