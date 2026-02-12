import {ReactNode} from 'react'
import { isAuthenticated } from "@/lib/Actions/auth.actions";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";

const Authlayout = async ({children}:{children: ReactNode}) => {
  const isUserAuthenticated=await isAuthenticated()
  if(isUserAuthenticated) redirect('/')
  return (
    <div className="auth-layout">
      {children}
    </div>
  )
}

export default Authlayout
