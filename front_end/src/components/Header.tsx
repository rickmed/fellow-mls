import Logo from "../../public/logo.png"

export function Header() {

   return (
      <div className="flex items-center">
         <div aria-label="logo group" className="flex items-center">
            <img className= "size-10" src={Logo} alt="Fellow MLS logo" />
            <div className="text-lg text-blue-500 font-bold tracking-tighter logo-font">Fellow MLS</div>
         </div>
         <input aria-label="text" className="flex-1 border-gray-300 border-2 rounded-md" />
         <div aria-label="right links" className="flex">
            <section className="bg-orange-300">About</section>
            <section className="bg-orange-300">Help</section>
            <section className="bg-orange-300">Sign in</section>
         </div>
      </div>
   )
}