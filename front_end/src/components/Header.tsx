import Logo from "../../public/logo.png"

export function Header() {

   const inputStyle = {
      maxWidth: "500px",
   }

   return (
      <div className="flex gap-10 items-center justify-between mt-2">
         <div aria-label="logo group" className="flex gap-1 items-center ml-4">
            <img className= "size-8" src={Logo} alt="Fellow MLS logo" />
            <div className="text-lg text-blue-500 font-bold tracking-tighter logo-font">Fellow MLS</div>
         </div>
         <input aria-label="text" className="flex-1 border-gray-400 border rounded-md text-lg text-gray-700 py-2 px-4 placeholder:text-sm focus:border-dark-blue focus:outline-none" style={inputStyle} placeholder="Urbanizacion, Precio, Detalles..." />
         <div aria-label="right links" className="flex gap-6 mr-6 text-gray-500 text-sm">
            <a className="hover:text-blue-800" href="/about">About</a>
            <a className="hover:text-blue-800" href="/help">Help</a>
            <a className="hover:text-blue-800" href="/sign-in">Sign In</a>
         </div>
      </div>
   )
}