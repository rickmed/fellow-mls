
import Logo from "../../public/logo.png"

export function Header() {

   return (
      <div className="flex gap-10 items-center justify-between mt-2">
         <div aria-label="logo group" className="flex gap-1 items-center ml-4">
            <img className="size-8" src={Logo} alt="Fellow MLS logo" />
            <div className="text-lg text-blue-500 font-bold tracking-tighter logo-font">Fellow MLS</div>
         </div>

         <div aria-label="search bar" className="
            flex-1 max-w-[500px] flex items-center
            py-2 px-4
            bg-zinc-100 border border-zinc-300 rounded-md
         ">
            <input type="text" className="
               flex-1
               bg-transparent
               text-lg text-zinc-700
               placeholder:text-sm placeholder:text-zinc-400
               focus:outline-none
            " placeholder="Urbanizacion, Precio, Detalles..." onFocus={onFocusInput}/>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6 bg-transparent stroke-zinc-400 stroke-2">
               <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            {/* <div className="flex items-center">
            </div> */}
         </div>
         <div aria-label="right links" className="flex gap-6 mr-6 text-gray-500 text-sm">
            <a className="hover:text-blue-800" href="/about">About</a>
            <a className="hover:text-blue-800" href="/help">Help</a>
            <a className="hover:text-blue-800" href="/sign-in">Sign In</a>
         </div>
      </div>
   )

   //
   function onFocusInput(ev: React.FocusEvent<HTMLInputElement, Element>) {
      // todo: div of parent
        // focus:border-dark-blue focus:border focus:outline-none
   }
}