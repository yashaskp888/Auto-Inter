"use client";
import dynamic from "next/dynamic";

const Authform = dynamic(() => import("./Authform"), {
  ssr: false,
});

export default Authform;
