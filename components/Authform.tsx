"use client"

import * as z from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import Image from "next/image"
import Link from "next/link"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import Formfield from "@/components/Formfield"
import { Form } from "@/components/ui/form"
import {signIn, signUP} from "@/lib/Actions/auth.actions"
import { useRouter } from "next/navigation"
import { createUserWithEmailAndPassword,signInWithEmailAndPassword } from "firebase/auth"
import { auth } from "@/firebase/client"

import { useEffect, useState } from "react";


  // rest of your component



type FormType = "sign-in" | "sign-up"

const AuthformSchema = (type: FormType) => {
  return z.object({
    name:
      type === "sign-up"
        ? z.string().min(2, "Name must be at least 2 characters.")
        : z.string().optional(),
    email: z.string().email("Invalid email"),
    password: z.string().min(6, "Password must be at least 3 characters"),
  })
}

const Authform = ({ type }: { type: FormType }) => {
  const Router=useRouter()
  const formSchema = AuthformSchema(type)
   const [mounted, setMounted] = useState(false);

  


  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  
  })
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const isSignIn = type === "sign-in"

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    try {
      if (type === "sign-up") {
        const {name,email,password}=data
        const userCredentials= await createUserWithEmailAndPassword(auth,email,password)
        const result=await signUP({
          uid:userCredentials.user.uid,
          name: name!,
          email,
          password
        })
        
        if (!result?.success){
           toast.error(result?.message)
           return 
          }
        toast.success("Account created successfully Please sign in")
        Router.push("/signin")
        console.log("Signned up:", data)
      } else {
        const {email,password}=data
        const userCredentials= await signInWithEmailAndPassword(auth,email,password)
        const idToken=await userCredentials.user.getIdToken(true)
        if (!idToken){
          toast.error("Sign in failed,Please try again")
          return
        }
        await signIn({email,idToken})
        toast.success("Signed in successfully")
        Router.push("/")
        console.log("Signing in:", data)
      }
    } catch (error) {
      console.log(error)
      toast.error("Something went wrong")
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="card-border flex w-full max-w-md flex-col items-center gap-6 px-10 py-10">
        <div className="flex items-center gap-2">
          <Image src="/logo.svg" alt="logo" width={70} height={20} />
          <h2 className="text-primary-100 text-xl font-semibold">AutoInter</h2>
        </div>

        <h4 className="text-center text-2xl text-accent-foreground">
          Practise Job Interview with AI
        </h4>
        <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="mt-4 w-full space-y-6"
        >
          {!isSignIn && <Formfield control={form.control} name="name" label="Name" placeholder="Enter your name" />}
          <Formfield control={form.control} name="email" label="Email" placeholder="Enter your email" type="email" />
          <Formfield control={form.control} name="password" label="Password" placeholder="Enter your password" type="password" />

          <Button type="submit" className="btn w-full">
            {isSignIn ? "Sign In" : "Create Account"}
          </Button>
        </form>
        </Form>

        <p className="text-center">
          {isSignIn ? "No Account yet?" : "Already have an account?"}
          <Link
            href={isSignIn ? "/signup" : "/signin"}
            className="ml-1 font-bold text-user-primary"
          >
            {isSignIn ? "Sign Up" : "Sign In"}
          </Link>
        </p>
      </div>
    </div>
  )
}

export default Authform
