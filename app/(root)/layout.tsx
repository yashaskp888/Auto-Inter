import Link from "next/link";
import {ReactNode} from 'react'
import Img from 'next/image'
import { isAuthenticated } from "@/lib/Actions/auth.actions";
import { logout } from "@/lib/Actions/auth.actions";







const Rootlayout =async ({children}:{children: ReactNode}) => {
    const loggedIn = await isAuthenticated();
  return (
    
    <div>
      <nav className="w-full flex items-center px-5 py-5 justify-between">
        <Link href="/" className="flex flex-row gap-2 px-0">
        <Img src="/logo.svg" alt="Logo" width={35} priority height={12} />
        <h2 className="text-primary-100 font-semibold">AutoInter</h2>
        </Link>
           {loggedIn && (
          <form action={logout}>
            <button className="btn-secondary">Logout</button>
          </form>
        )}
      </nav>
      {children}
    </div>
  )
}

export default Rootlayout
