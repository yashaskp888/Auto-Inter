'use server';

import {db,auth} from '../../firebase/admin';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { toast } from "sonner"
import { redirect } from "next/navigation";




export async function signUP (params:SignUpParams){
    const {uid,name,email}=params
    try {
        const userRecord= await db.collection('users').doc(uid).get()
        if (userRecord.exists){
            return{
                success:false,
                message:'User already exists with this UID.'
            }
        }
        const sayableId = String(Math.floor(1000 + Math.random() * 9000))
        await db.collection('users').doc(uid).set({
            name,email,sayableId
        })
        return{
            success:true,
            message:'User created successfully.Please sign in'
        }
    }
     catch (error: any) {
  console.error(error);

  if (error.code === "auth/email-already-in-use") {
    toast.error("An account with this email already exists. Please sign in.");
    return;
  }

  if (error.code === "auth/invalid-email") {
    toast.error("Please enter a valid email address.");
    return;
  }

  if (error.code === "auth/weak-password") {
    toast.error("Password must be at least 6 characters.");
    return;
  }

  toast.error("Something went wrong. Please try again.");
}



}
export async function signIn(params:SignInParams){
    const {email,idToken}=params
    try { 
        const userRecord=await auth.getUserByEmail(email)
        if (!userRecord){
            return{
                success:false,
                message:'User Does not exist,Create an account instead'
            }}
        await setSessionCookie(idToken)
        
        return{
            success:true,
            message:'Signed in successfully'
        }
    }catch (e:any){
        console.log("Error signing in:", e);}
}


export async function setSessionCookie(idToken:string) {
    const cookieStore= await cookies()
    const sessionCookie=await auth.createSessionCookie(idToken,{expiresIn:60*60*24*7*1000})
    

  cookieStore.set('session', sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days in seconds
  });

  
}




export async function logout() {
    const cookieStore= await cookies()
    cookieStore.delete("session");
}

function generateSayableId(): string {
    return String(Math.floor(1000 + Math.random() * 9000))
}

/* this is to render the signup page as the first page when the user visits the site rather than home page*/
export async function getCurrentUser():Promise<User | null>{
    const cookieStore= await cookies()
    const sessionCookie= cookieStore.get('session')?.value;
    if (!sessionCookie){
        return null
    }
    try{
        const decodedClaims=await auth.verifySessionCookie(sessionCookie,true)
        const userRef=db.collection('users').doc(decodedClaims.uid)
        const userRecord=await userRef.get()
        if (!userRecord.exists){
            return null
        }
        const data = userRecord.data() || {}
        if (!data.sayableId) {
            const sayableId = generateSayableId()
            await userRef.update({ sayableId })
            data.sayableId = sayableId
        }
        return {
            ...data,
            id: userRecord.id
    } as User
    }catch (e){
        console.log("Error getting current user:", e)
        return null
    }}
export async function isAuthenticated(){
    const user=await getCurrentUser()
    return !!user
}